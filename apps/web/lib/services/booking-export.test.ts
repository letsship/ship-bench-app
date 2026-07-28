import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed, SEED_NOW } from "@/lib/db/seed-data";
import { listBookingExportRows } from "./booking-export";

function setup() {
  const seed = buildSeed(SEED_NOW);
  const repos = createInMemoryRepositories(seed);
  return { repos, studioId: seed.studio.id };
}

describe("listBookingExportRows", () => {
  it("returns all booking rows when no range is given", async () => {
    const { repos, studioId } = setup();
    const rows = await listBookingExportRows(repos, studioId);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("filters inclusively on the from bound", async () => {
    const { repos, studioId } = setup();
    // Use a from time that cuts out the earliest sessions.
    const from = "2026-07-01T12:00:00.000Z";
    const rows = await listBookingExportRows(repos, studioId, { from });
    // No row should have a startsAt earlier than from.
    for (const row of rows) {
      expect(row.startsAt >= from).toBe(true);
    }
  });

  it("filters inclusively on the to bound (session exactly on to IS included)", async () => {
    const { repos, studioId } = setup();
    // Find a session start time that exists so we can test the inclusive bound.
    const sessions = await repos.classSessions.listByStudio(studioId);
    expect(sessions.length).toBeGreaterThan(0);

    // Pick a specific session start and set `to` exactly to that time.
    const targetStart = sessions[0].startsAt;
    const rows = await listBookingExportRows(repos, studioId, { to: targetStart });

    // The session whose start == targetStart should have its bookings present.
    // No row should have a startsAt later than targetStart.
    for (const row of rows) {
      expect(row.startsAt <= targetStart).toBe(true);
    }

    // At least one row should have that exact target start time.
    const exactMatch = rows.filter((r) => r.startsAt === targetStart);
    expect(exactMatch.length).toBeGreaterThan(0);
  });

  it("filters to the intersection when both from and to are given", async () => {
    const { repos, studioId } = setup();
    const from = "2026-07-01T08:00:00.000Z";
    const to = "2026-07-02T12:00:00.000Z";
    const rows = await listBookingExportRows(repos, studioId, { from, to });
    for (const row of rows) {
      expect(row.startsAt >= from).toBe(true);
      expect(row.startsAt <= to).toBe(true);
    }
  });

  it("omitting from widens the range to include earlier sessions", async () => {
    const { repos, studioId } = setup();
    const all = await listBookingExportRows(repos, studioId);
    const to = "2026-07-01T08:00:00.000Z";
    const subset = await listBookingExportRows(repos, studioId, { to });
    expect(subset.length).toBeLessThan(all.length);
  });

  it("each row carries the joined fields", async () => {
    const { repos, studioId } = setup();
    const rows = await listBookingExportRows(repos, studioId);
    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0];
    expect(row).toHaveProperty("startsAt");
    expect(row).toHaveProperty("className");
    expect(row).toHaveProperty("memberName");
    expect(row).toHaveProperty("email");
    expect(row).toHaveProperty("status");
    // Verify the email is a non-empty string from the member data.
    expect(typeof row.email).toBe("string");
    expect(row.email.length).toBeGreaterThan(0);
    // Verify className is a non-empty string.
    expect(typeof row.className).toBe("string");
    expect(row.className.length).toBeGreaterThan(0);
  });

  it("rows are sorted by startsAt ascending", async () => {
    const { repos, studioId } = setup();
    const rows = await listBookingExportRows(repos, studioId);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].startsAt >= rows[i - 1].startsAt).toBe(true);
    }
  });
});