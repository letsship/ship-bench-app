import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Repositories } from "@/lib/db/repos/types";
import { listBookingsForExport } from "./export";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("listBookingsForExport", () => {
  let repos: Repositories;
  let studioId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = await repos.studios.getFirst();
    studioId = studio?.id ?? "";
  });

  it("returns all bookings joined with class + member + email data when unfiltered", async () => {
    const rows = await listBookingsForExport(repos, studioId);
    const allBookings = await repos.bookings.listBySessionIds(
      (await repos.classSessions.listByStudio(studioId)).map((session) => session.id),
    );
    expect(rows.length).toBe(allBookings.length);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.className).not.toBe("");
      expect(row.memberName).not.toBe("");
      expect(row.memberEmail).not.toBe("");
      expect(row.status).not.toBe("");
    }
  });

  it("sorts rows by session start ascending", async () => {
    const rows = await listBookingsForExport(repos, studioId);
    const starts = rows.map((row) => row.startsAt);
    expect(starts).toEqual([...starts].sort((a, b) => a.localeCompare(b)));
  });

  it("includes a session exactly on the `to` boundary (inclusive-both-ends)", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const boundary = sessions[Math.floor(sessions.length / 2)].startsAt;
    const rows = await listBookingsForExport(repos, studioId, { to: boundary });
    expect(rows.some((row) => row.startsAt === boundary)).toBe(true);
    expect(rows.every((row) => row.startsAt <= boundary)).toBe(true);
  });

  it("includes a session exactly on the `from` boundary", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const boundary = sessions[Math.floor(sessions.length / 2)].startsAt;
    const rows = await listBookingsForExport(repos, studioId, { from: boundary });
    expect(rows.every((row) => row.startsAt >= boundary)).toBe(true);
  });

  it("is unbounded on a side when that bound is omitted", async () => {
    const sessions = await repos.classSessions.listByStudio(studioId);
    const from = sessions[1].startsAt;
    const withFromOnly = await listBookingsForExport(repos, studioId, { from });
    const withNeither = await listBookingsForExport(repos, studioId);
    expect(withFromOnly.length).toBeLessThanOrEqual(withNeither.length);
    expect(withFromOnly.every((row) => row.startsAt >= from)).toBe(true);
  });
});
