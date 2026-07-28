import { describe, expect, it, vi } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking } from "@/lib/db/types";
import { listBookingRows } from "./booking-list";

const NOW = new Date();

// Regression coverage for the bookings-list N+1: joining rows to members and
// class sessions must use a small, fixed number of batched repository reads,
// no matter how many bookings the list returns.

function seedWithBookings(multiplier: number) {
  const seed = buildSeed(NOW);
  const bookings: Booking[] = [];
  for (let round = 0; round < multiplier; round += 1) {
    for (const booking of seed.bookings) {
      bookings.push({ ...booking, id: `${booking.id}-x${round}` });
    }
  }
  return { ...seed, bookings };
}

interface ReadCounts {
  memberReads: number;
  sessionReads: number;
}

function countReads(repos: Repositories): ReadCounts {
  const counts: ReadCounts = { memberReads: 0, sessionReads: 0 };
  const wrap = (repo: Record<string, unknown>, key: "memberReads" | "sessionReads") => {
    for (const name of Object.keys(repo)) {
      const original = repo[name] as (...args: unknown[]) => unknown;
      vi.spyOn(repo as never, name as never).mockImplementation((...args: unknown[]) => {
        counts[key] += 1;
        return original(...args);
      });
    }
  };
  wrap(repos.members as unknown as Record<string, unknown>, "memberReads");
  wrap(repos.classSessions as unknown as Record<string, unknown>, "sessionReads");
  return counts;
}

async function rowsAndReads(multiplier: number) {
  const seed = seedWithBookings(multiplier);
  const repos = createInMemoryRepositories(seed);
  const counts = countReads(repos);
  const rows = await listBookingRows(repos, seed.studio.id);
  return { seed, rows, counts };
}

describe("listBookingRows bounded reads", () => {
  it("joins rows to member + class session with the expected fields and order", async () => {
    const { seed, rows } = await rowsAndReads(1);
    expect(rows).toHaveLength(seed.bookings.length);
    const row = rows[0];
    expect(row).toHaveProperty("id");
    expect(row).toHaveProperty("memberName");
    expect(row).toHaveProperty("className");
    expect(row).toHaveProperty("classColor");
    expect(row).toHaveProperty("instructor");
    expect(row).toHaveProperty("startsAt");
    expect(row).toHaveProperty("status");
    const sorted = [...rows].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    expect(rows.map((r) => r.id)).toEqual(sorted.map((r) => r.id));
    expect(rows.every((r) => r.memberName.length > 0 && r.className.length > 0)).toBe(true);
  });

  it("never reads the members or class-sessions repository once per booking", async () => {
    const { seed, rows, counts } = await rowsAndReads(4);
    expect(rows.length).toBeGreaterThan(0);
    // A small, fixed number of batched reads — far below one read per row.
    expect(counts.memberReads).toBeLessThanOrEqual(2);
    expect(counts.sessionReads).toBeLessThanOrEqual(2);
    expect(counts.memberReads).toBeLessThan(rows.length);
    expect(counts.sessionReads).toBeLessThan(rows.length);
    expect(seed.bookings.length).toBe(rows.length);
  });

  it("keeps read counts constant when the booking count doubles", async () => {
    const small = await rowsAndReads(2);
    const large = await rowsAndReads(4);
    expect(large.rows.length).toBe(small.rows.length * 2);
    expect(large.counts).toEqual(small.counts);
  });

  it("returns identical output for the same data regardless of read strategy", async () => {
    const { seed, rows } = await rowsAndReads(1);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const memberById = new Map(seed.members.map((member) => [member.id, member]));
    const sessionById = new Map(seed.sessions.map((session) => [session.id, session]));
    const typeById = new Map(seed.classTypes.map((type) => [type.id, type]));
    for (const booking of seed.bookings) {
      const session = sessionById.get(booking.sessionId);
      const classType = session ? typeById.get(session.classTypeId) : undefined;
      const member = memberById.get(booking.memberId);
      expect(byId.get(booking.id)).toEqual({
        id: booking.id,
        memberName: member?.name ?? "—",
        className: classType?.name ?? "Class",
        classColor: classType?.color ?? "#6b7280",
        instructor: session?.instructor ?? "",
        startsAt: session?.startsAt ?? "",
        status: booking.status,
      });
    }
  });
});
