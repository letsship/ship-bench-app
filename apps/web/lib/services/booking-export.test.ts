import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { listBookingExportRows } from "./booking-export";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("listBookingExportRows", () => {
  it("returns bookings with the correct fields", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const rows = await listBookingExportRows(repos, seed.studio.id);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("startsAt");
    expect(rows[0]).toHaveProperty("className");
    expect(rows[0]).toHaveProperty("memberName");
    expect(rows[0]).toHaveProperty("email");
    expect(rows[0]).toHaveProperty("status");
  });

  it("includes bookings starting exactly at the 'from' boundary", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const allRows = await listBookingExportRows(repos, seed.studio.id);

    if (allRows.length > 0) {
      const fromBoundary = allRows[0].startsAt;
      const filtered = await listBookingExportRows(repos, seed.studio.id, { from: fromBoundary });

      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.some((row) => row.startsAt === fromBoundary)).toBe(true);
    }
  });

  it("includes bookings ending exactly at the 'to' boundary", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const allRows = await listBookingExportRows(repos, seed.studio.id);

    if (allRows.length > 0) {
      const toBoundary = allRows[allRows.length - 1].startsAt;
      const filtered = await listBookingExportRows(repos, seed.studio.id, { to: toBoundary });

      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.some((row) => row.startsAt === toBoundary)).toBe(true);
    }
  });

  it("excludes bookings before the 'from' boundary", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const allRows = await listBookingExportRows(repos, seed.studio.id);

    if (allRows.length > 1) {
      const fromBoundary = allRows[Math.floor(allRows.length / 2)].startsAt;
      const filtered = await listBookingExportRows(repos, seed.studio.id, { from: fromBoundary });

      expect(filtered.every((row) => row.startsAt >= fromBoundary)).toBe(true);
    }
  });

  it("excludes bookings after the 'to' boundary", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const allRows = await listBookingExportRows(repos, seed.studio.id);

    if (allRows.length > 1) {
      const toBoundary = allRows[Math.floor(allRows.length / 2)].startsAt;
      const filtered = await listBookingExportRows(repos, seed.studio.id, { to: toBoundary });

      expect(filtered.every((row) => row.startsAt <= toBoundary)).toBe(true);
    }
  });

  it("returns all bookings when bounds are omitted", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const unbounded = await listBookingExportRows(repos, seed.studio.id);
    const withBounds = await listBookingExportRows(repos, seed.studio.id, {});

    expect(unbounded.length).toBe(withBounds.length);
  });

  it("preserves the startsAt sort order", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const rows = await listBookingExportRows(repos, seed.studio.id);

    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].startsAt >= rows[i - 1].startsAt).toBe(true);
    }
  });
});
