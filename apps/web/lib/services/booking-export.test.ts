import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { listBookingExportRows } from "./booking-export";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function createSeededRepositories() {
  const seed = buildSeed(NOW);
  return { repos: createInMemoryRepositories(seed), seed };
}

describe("listBookingExportRows", () => {
  it("includes member email and orders rows by session start", async () => {
    const { repos, seed } = createSeededRepositories();

    const rows = await listBookingExportRows(repos, seed.studio.id);

    expect(rows[0]?.memberEmail).toContain("@");
    expect(rows.map((row) => row.startsAt)).toEqual(
      [...rows.map((row) => row.startsAt)].sort((a, b) => a.localeCompare(b)),
    );
  });

  it("leaves either omitted range bound unbounded", async () => {
    const { repos, seed } = createSeededRepositories();
    const startsAt = seed.sessions[10]?.startsAt;

    if (!startsAt) throw new Error("Expected seeded session");

    const fromRows = await listBookingExportRows(repos, seed.studio.id, { from: startsAt });
    const toRows = await listBookingExportRows(repos, seed.studio.id, { to: startsAt });

    expect(fromRows).not.toHaveLength(0);
    expect(toRows).not.toHaveLength(0);
    expect(fromRows.every((row) => row.startsAt >= startsAt)).toBe(true);
    expect(toRows.every((row) => row.startsAt <= startsAt)).toBe(true);
  });

  it("includes sessions that start exactly at either range boundary", async () => {
    const { repos, seed } = createSeededRepositories();
    const startsAt = seed.sessions[10]?.startsAt;

    if (!startsAt) throw new Error("Expected seeded session");

    const toRows = await listBookingExportRows(repos, seed.studio.id, { to: startsAt });
    const fromRows = await listBookingExportRows(repos, seed.studio.id, { from: startsAt });

    expect(toRows.some((row) => row.startsAt === startsAt)).toBe(true);
    expect(fromRows.some((row) => row.startsAt === startsAt)).toBe(true);
  });
});
