import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { listBookingRowsInRange } from "./booking-list";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("listBookingRowsInRange", () => {
  let repos: Awaited<ReturnType<typeof createInMemoryRepositories>>;
  let studioId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    studioId = (await repos.studios.getFirst())?.id ?? "";
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns all bookings when no from/to are specified", async () => {
    const rows = await listBookingRowsInRange(repos, studioId);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("filters inclusively by from date (excludes earlier bookings)", async () => {
    const allRows = await listBookingRowsInRange(repos, studioId);
    expect(allRows.length).toBeGreaterThan(0);
    const sortedDates = [...allRows].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const from = sortedDates[sortedDates.length - 5]?.startsAt;
    if (from) {
      const rows = await listBookingRowsInRange(repos, studioId, from);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.startsAt >= from)).toBe(true);
      expect(rows.some((row) => row.startsAt === from)).toBe(true);
    }
  });

  it("filters inclusively by to date (excludes later bookings)", async () => {
    const allRows = await listBookingRowsInRange(repos, studioId);
    expect(allRows.length).toBeGreaterThan(0);
    const sortedDates = [...allRows].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const to = sortedDates[Math.floor(sortedDates.length / 2)]?.startsAt;
    if (to) {
      const rows = await listBookingRowsInRange(repos, studioId, undefined, to);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.startsAt <= to)).toBe(true);
      expect(rows.some((row) => row.startsAt === to)).toBe(true);
    }
  });

  it("filters on both ends inclusively", async () => {
    const allRows = await listBookingRowsInRange(repos, studioId);
    expect(allRows.length).toBeGreaterThan(0);
    const sortedDates = [...allRows].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const from = sortedDates[0]?.startsAt;
    const to = sortedDates[sortedDates.length - 1]?.startsAt;
    if (from && to) {
      const rows = await listBookingRowsInRange(repos, studioId, from, to);
      expect(rows.length).toBe(sortedDates.length);
      expect(rows.every((row) => row.startsAt >= from && row.startsAt <= to)).toBe(true);
    }
  });

  it("preserves email field in the output", async () => {
    const rows = await listBookingRowsInRange(repos, studioId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("email");
    expect(typeof rows[0].email).toBe("string");
  });
});
