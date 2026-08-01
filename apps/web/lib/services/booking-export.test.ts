import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { listBookingsForExport } from "./booking-export";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function fixture() {
  const seed = buildSeed(NOW);
  return { seed, repos: createInMemoryRepositories(seed) };
}

describe("listBookingsForExport", () => {
  it("joins class name, member name, email, and booking status", async () => {
    const { seed, repos } = fixture();
    const rows = await listBookingsForExport(repos, seed.studio.id);

    expect(rows.length).toBe(seed.bookings.length);
    const classNames = new Set(seed.classTypes.map((type) => type.name));
    const emailsByName = new Map(seed.members.map((member) => [member.name, member.email]));
    for (const row of rows) {
      expect(classNames.has(row.className)).toBe(true);
      expect(emailsByName.get(row.memberName)).toBe(row.email);
      expect(row.status).toBeTruthy();
      expect(row.startsAt).toBeTruthy();
    }
  });

  it("sorts rows by session start", async () => {
    const { seed, repos } = fixture();
    const rows = await listBookingsForExport(repos, seed.studio.id);
    const starts = rows.map((row) => row.startsAt);
    expect(starts).toEqual([...starts].sort());
  });

  it("includes bookings starting exactly at the from bound", async () => {
    const { seed, repos } = fixture();
    const all = await listBookingsForExport(repos, seed.studio.id);
    const starts = [...new Set(all.map((row) => row.startsAt))].sort();
    const from = starts[1];

    const rows = await listBookingsForExport(repos, seed.studio.id, { from });
    expect(rows.some((row) => row.startsAt === from)).toBe(true);
    expect(rows.every((row) => row.startsAt >= from)).toBe(true);
  });

  it("includes bookings starting exactly at the to bound (inclusive, not half-open)", async () => {
    const { seed, repos } = fixture();
    const all = await listBookingsForExport(repos, seed.studio.id);
    const starts = [...new Set(all.map((row) => row.startsAt))].sort();
    // Pick a bound with sessions both at and after it, so an exclusive
    // (half-open) upper bound would fail this test.
    const to = starts[starts.length - 2];

    const rows = await listBookingsForExport(repos, seed.studio.id, { to });
    expect(rows.some((row) => row.startsAt === to)).toBe(true);
    expect(rows.every((row) => row.startsAt <= to)).toBe(true);
    expect(rows.length).toBeLessThan(all.length);
  });

  it("applies both bounds together, inclusively", async () => {
    const { seed, repos } = fixture();
    const all = await listBookingsForExport(repos, seed.studio.id);
    const starts = [...new Set(all.map((row) => row.startsAt))].sort();
    const from = starts[1];
    const to = starts[starts.length - 2];

    const rows = await listBookingsForExport(repos, seed.studio.id, { from, to });
    expect(rows.some((row) => row.startsAt === from)).toBe(true);
    expect(rows.some((row) => row.startsAt === to)).toBe(true);
    expect(rows.every((row) => row.startsAt >= from && row.startsAt <= to)).toBe(true);
  });

  it("treats an omitted bound as unbounded on that side", async () => {
    const { seed, repos } = fixture();
    const all = await listBookingsForExport(repos, seed.studio.id);
    const starts = [...new Set(all.map((row) => row.startsAt))].sort();
    const earliest = starts[0];
    const latest = starts[starts.length - 1];

    const fromOnly = await listBookingsForExport(repos, seed.studio.id, { from: earliest });
    expect(fromOnly.some((row) => row.startsAt === latest)).toBe(true);
    expect(fromOnly.length).toBe(all.length);

    const toOnly = await listBookingsForExport(repos, seed.studio.id, { to: latest });
    expect(toOnly.some((row) => row.startsAt === earliest)).toBe(true);
    expect(toOnly.length).toBe(all.length);
  });
});
