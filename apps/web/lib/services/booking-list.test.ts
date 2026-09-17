import { describe, expect, it, vi } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { BookingRow } from "./booking-list";
import { listBookingRows } from "./booking-list";

const NOW = new Date("2026-07-01T12:00:00.000Z");

function expectedRowsFromSeed(seed: SeedData): BookingRow[] {
  const sessionById = new Map(seed.sessions.map((s) => [s.id, s]));
  const typeById = new Map(seed.classTypes.map((t) => [t.id, t]));
  const memberById = new Map(seed.members.map((m) => [m.id, m]));
  const rows: BookingRow[] = seed.bookings.map((b) => {
    const session = sessionById.get(b.sessionId);
    const classType = session ? typeById.get(session.classTypeId) : undefined;
    const member = memberById.get(b.memberId);
    return {
      id: b.id,
      memberName: member?.name ?? "—",
      className: classType?.name ?? "Class",
      classColor: classType?.color ?? "#6b7280",
      instructor: session?.instructor ?? "",
      startsAt: session?.startsAt ?? "",
      status: b.status,
    };
  });
  return rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function buildLargeSeed(studioId: string): SeedData {
  const base = buildSeed(NOW);
  const members = Array.from({ length: 40 }, (_, i) => ({
    id: `lm-${i}`,
    studioId,
    name: `Member ${i}`,
    email: `lm${i}@e.co`,
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: NOW.toISOString(),
  }));
  const classTypes = [
    {
      id: "lct-1",
      studioId,
      name: "Large Yoga",
      description: null,
      color: "#123456",
      defaultCapacity: 20,
      defaultPriceCents: 2000,
      createdAt: NOW.toISOString(),
    },
  ];
  const sessions = Array.from({ length: 20 }, (_, i) => ({
    id: `ls-${i}`,
    studioId,
    classTypeId: "lct-1",
    instructor: `Instructor ${i % 5}`,
    startsAt: new Date(NOW.getTime() + i * 3_600_000).toISOString(),
    endsAt: new Date(NOW.getTime() + i * 3_600_000 + 3_600_000).toISOString(),
    capacity: 20,
    priceCents: 2000,
    status: "scheduled",
    createdAt: NOW.toISOString(),
  }));
  const bookings = Array.from({ length: 200 }, (_, i) => ({
    id: `lb-${i}`,
    sessionId: sessions[i % sessions.length].id,
    memberId: members[i % members.length].id,
    status: "booked",
    bookedAt: NOW.toISOString(),
    cancelledAt: null,
  }));
  return {
    ...base,
    members: [...base.members, ...members],
    classTypes: [...base.classTypes, ...classTypes],
    sessions: [...base.sessions, ...sessions],
    bookings: [...base.bookings, ...bookings],
  };
}

describe("listBookingRows", () => {
  it("golden output: rows, fields, and order match the seed join (AC-1)", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const studio = await repos.studios.getFirst();
    const studioId = studio?.id ?? "";

    const rows = await listBookingRows(repos, studioId);
    const expected = expectedRowsFromSeed(seed);

    expect(rows).toEqual(expected);
  });

  it("issues a bounded, N-independent number of repo reads (AC-2)", async () => {
    const smallSeed = buildSeed(NOW);
    const smallStudioId = smallSeed.studio.id;
    const largeSeed = buildLargeSeed(smallStudioId);

    const cases = [
      { label: "small seed", seed: smallSeed, sid: smallStudioId },
      { label: "large seed (~200 bookings)", seed: largeSeed, sid: smallStudioId },
    ];

    for (const { seed, sid } of cases) {
      const repos = createInMemoryRepositories(seed);

      const memberGetById = vi.spyOn(repos.members, "getById");
      const sessionGetById = vi.spyOn(repos.classSessions, "getById");
      const memberListByIds = vi.spyOn(repos.members, "listByIds");
      const sessionListByStudio = vi.spyOn(repos.classSessions, "listByStudio");
      const bookingsListBySessionIds = vi.spyOn(repos.bookings, "listBySessionIds");

      const rows = await listBookingRows(repos, sid);

      expect(rows.length).toBeGreaterThan(0);
      expect(memberGetById).not.toHaveBeenCalled();
      expect(sessionGetById).not.toHaveBeenCalled();
      expect(memberListByIds).toHaveBeenCalledTimes(1);
      expect(sessionListByStudio).toHaveBeenCalledTimes(1);
      expect(bookingsListBySessionIds).toHaveBeenCalledTimes(1);
    }
  });

  it("falls back to defaults when a booking's member is missing", async () => {
    const seed = buildSeed(NOW);
    const studioId = seed.studio.id;
    const session = seed.sessions[0];
    const orphan = {
      id: "orphan-1",
      sessionId: session.id,
      memberId: "no-such-member",
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    };
    const repos = createInMemoryRepositories({
      ...seed,
      bookings: [...seed.bookings, orphan],
    });
    const rows = await listBookingRows(repos, studioId);
    const orphanRow = rows.find((r) => r.id === "orphan-1");
    expect(orphanRow).toBeDefined();
    expect(orphanRow?.memberName).toBe("—");
    expect(orphanRow?.className).toBe(
      seed.classTypes.find((t) => t.id === session.classTypeId)?.name ?? "Class",
    );
    expect(orphanRow?.instructor).toBe(session.instructor);
  });
});
