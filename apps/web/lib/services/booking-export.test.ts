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

  it("includes a boundary session when startsAt is '+00:00' form and from is 'Z' form", async () => {
    // Supabase returns timestamptz as `...+00:00` while callers pass canonical
    // `...Z` ISO-8601. Lexical compare would drop the boundary (`+` < `Z`),
    // so this pins the epoch-based comparison.
    const repos = withSeed();
    const studio = await repos.studios.getFirst();
    const sessions = await repos.classSessions.listByStudio(studio!.id);
    const earliest = [...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    // Insert a fresh session at the exact same instant but in `+00:00` form,
    // with a booking so it surfaces in the export.
    const offsetForm = earliest.startsAt.replace(/\.\d{3}Z$/, "+00:00");
    const offsetSession = await repos.classSessions.insert({
      ...earliest,
      id: "sess-offset",
      startsAt: offsetForm,
    });
    const aMember = (await repos.members.listByStudio(studio!.id))[0];
    await repos.bookings.insert({
      id: "bk-offset",
      sessionId: offsetSession.id,
      memberId: aMember.id,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });

    const zForm = offsetForm.replace("+00:00", "Z");
    const rows = await listBookingExportRows(repos, studio!.id, { from: zForm });
    expect(rows.map((r) => r.startsAt)).toContain(offsetForm);
  });

  it("includes a session at 'to' even when the '+' offset was corrupted to a space", async () => {
    // URLSearchParams decodes '+' to a space, so a `to` of `...+00:01`
    // arrives as `... 00:01`. The service must restore it before parsing.
    const repos = withSeed();
    const studio = await repos.studios.getFirst();
    const sessions = await repos.classSessions.listByStudio(studio!.id);
    const sorted = [...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const target = sorted[sorted.length - 1];
    const targetMs = Date.parse(target.startsAt);
    // A `to` one minute after the latest session, with a `+00:01` offset that
    // has been corrupted (`+` -> space) by query decoding. Must still include
    // the latest session (inclusive upper bound).
    const corrupted = new Date(targetMs + 60_000)
      .toISOString()
      .replace(/(\d{2}:\d{2}:\d{2})\.\d{3}Z$/, "$1 00:01");
    const rows = await listBookingExportRows(repos, studio!.id, { to: corrupted });
    expect(rows.map((r) => r.startsAt)).toContain(target.startsAt);
  });
});
