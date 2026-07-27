import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { listBookingExportRows } from "./booking-export";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("listBookingExportRows", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("joins booking to class session, class type, and member with email", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const seed = buildSeed(NOW);
    const studioId = seed.studio.id;

    const rows = await listBookingExportRows(repos, studioId);

    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0];
    expect(row).toHaveProperty("startsAt");
    expect(row).toHaveProperty("className");
    expect(row).toHaveProperty("memberName");
    expect(row).toHaveProperty("memberEmail");
    expect(row).toHaveProperty("status");
    expect(row.memberEmail).toMatch(/@/);
  });

  it("filters with both range ends inclusive", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const seed = buildSeed(NOW);
    const studioId = seed.studio.id;

    // Get all bookings first to find appropriate range
    const allRows = await listBookingExportRows(repos, studioId);
    if (allRows.length < 2) {
      // Skip this test if we don't have enough data
      return;
    }

    const sorted = [...allRows].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    // Filter with exact start time (should include)
    const fromOnly = await listBookingExportRows(repos, studioId, { from: first.startsAt });
    expect(fromOnly.length).toBeGreaterThan(0);
    expect(fromOnly[0].startsAt).toBe(first.startsAt);

    // Filter with exact end time (should include)
    const toOnly = await listBookingExportRows(repos, studioId, { to: last.startsAt });
    expect(toOnly.some((r) => r.startsAt === last.startsAt)).toBe(true);

    // Filter with both bounds (should include both)
    const fromTo = await listBookingExportRows(repos, studioId, {
      from: first.startsAt,
      to: last.startsAt,
    });
    expect(fromTo.length).toBeGreaterThan(0);
    expect(fromTo[0].startsAt).toBe(first.startsAt);
    expect(fromTo.some((r) => r.startsAt === last.startsAt)).toBe(true);
  });

  it("excludes bookings outside the range", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const seed = buildSeed(NOW);
    const studioId = seed.studio.id;

    const rows = await listBookingExportRows(repos, studioId, {
      from: "2099-01-01T00:00:00Z",
      to: "2099-12-31T23:59:59Z",
    });

    expect(rows).toEqual([]);
  });

  it("is unbounded when range is omitted", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const seed = buildSeed(NOW);
    const studioId = seed.studio.id;

    const allRows = await listBookingExportRows(repos, studioId);
    const fromOnly = await listBookingExportRows(repos, studioId, { from: undefined });
    const toOnly = await listBookingExportRows(repos, studioId, { to: undefined });

    expect(fromOnly.length).toBe(allRows.length);
    expect(toOnly.length).toBe(allRows.length);
  });

  it("sorts by session start time", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const seed = buildSeed(NOW);
    const studioId = seed.studio.id;

    const rows = await listBookingExportRows(repos, studioId);

    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].startsAt.localeCompare(rows[i - 1].startsAt)).toBeGreaterThanOrEqual(0);
    }
  });
});
