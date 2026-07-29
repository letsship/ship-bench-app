import { describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { listBookingExportRows } from "./booking-export";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function withSeed() {
  const repos = createInMemoryRepositories(buildSeed(NOW));
  __setTestRepositories(repos);
  return repos;
}

describe("listBookingExportRows", () => {
  it("joins bookings to class, member name, email and status", async () => {
    const repos = withSeed();
    const studio = await repos.studios.getFirst();
    const rows = await listBookingExportRows(repos, studio!.id);

    expect(rows.length).toBeGreaterThan(0);
    const first = rows[0];
    expect(first.className).toBeTruthy();
    expect(first.memberName).toBeTruthy();
    expect(first.email).toMatch(/@example\.com$/);
    expect(["booked", "attended", "no_show", "waitlisted", "cancelled"]).toContain(first.status);
  });

  it("orders rows by session startsAt ascending", async () => {
    const repos = withSeed();
    const studio = await repos.studios.getFirst();
    const rows = await listBookingExportRows(repos, studio!.id);
    const starts = rows.map((row) => row.startsAt);
    const sorted = [...starts].sort((a, b) => a.localeCompare(b));
    expect(starts).toEqual(sorted);
  });

  it("includes sessions exactly at 'from' and exactly at 'to'", async () => {
    const repos = withSeed();
    const studio = await repos.studios.getFirst();
    const sessions = await repos.classSessions.listByStudio(studio!.id);
    const starts = sessions.map((s) => s.startsAt).sort((a, b) => a.localeCompare(b));
    const from = starts[0];
    const to = starts[starts.length - 1];

    const rows = await listBookingExportRows(repos, studio!.id, { from, to });
    const rowStarts = new Set(rows.map((row) => row.startsAt));
    expect(rowStarts.has(from)).toBe(true);
    expect(rowStarts.has(to)).toBe(true);
  });

  it("excludes sessions outside the range on both ends", async () => {
    const repos = withSeed();
    const studio = await repos.studios.getFirst();
    const sessions = await repos.classSessions.listByStudio(studio!.id);
    const sorted = [...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    // Window strictly inside the first..last, picking 2nd..(n-1)th.
    const from = sorted[1].startsAt;
    const to = sorted[sorted.length - 2].startsAt;

    const rows = await listBookingExportRows(repos, studio!.id, { from, to });
    for (const row of rows) {
      expect(row.startsAt >= from).toBe(true);
      expect(row.startsAt <= to).toBe(true);
    }
    expect(rows.some((row) => row.startsAt === sorted[0].startsAt)).toBe(false);
    expect(rows.some((row) => row.startsAt === sorted[sorted.length - 1].startsAt)).toBe(false);
  });

  it("treats an omitted bound as unbounded on that side", async () => {
    const repos = withSeed();
    const studio = await repos.studios.getFirst();
    const all = await listBookingExportRows(repos, studio!.id);
    const fromOnly = await listBookingExportRows(repos, studio!.id, {
      from: all[0].startsAt,
    });
    const toOnly = await listBookingExportRows(repos, studio!.id, {
      to: all[all.length - 1].startsAt,
    });
    expect(fromOnly.length).toBe(all.length);
    expect(toOnly.length).toBe(all.length);
  });
});
