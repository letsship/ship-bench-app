import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as exportGet } from "@/app/api/export/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Repositories } from "@/lib/db/repos/types";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// The export route gates on a signed-in session. In a unit test there is no
// Next request scope for the cookie store to read from, so stub the auth seam:
// the route still calls requireSession(), we just short-circuit it to a known
// session. AC1 ("requires a signed-in session") is enforced by the route code.
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "ops@riverbank.example" }),
  SESSION_COOKIE: "studiobook_session",
}));

// Sessions in the seed land on calendar days around NOW at 08:00/12:00/17:00
// UTC. The 2026-03-15 sessions start at exactly these three timestamps.
const DAY_STARTS = [
  "2026-03-15T08:00:00.000Z",
  "2026-03-15T12:00:00.000Z",
  "2026-03-15T17:00:00.000Z",
  "2026-03-16T08:00:00.000Z",
];

function parseRows(csv: string): string[] {
  const lines = csv.split("\r\n");
  return lines.slice(1).filter((line) => line.length > 0);
}

function startsOf(csv: string): string[] {
  return parseRows(csv).map((line) => line.split(",")[0]);
}

describe("GET /api/export?type=bookings", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns 200 with the spec header row", async () => {
    const res = await exportGet(
      new NextRequest("http://localhost/api/export?type=bookings"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="studiobook-bookings.csv"',
    );
    const csv = await res.text();
    expect(csv.split("\r\n")[0]).toBe("Starts,Class,Member,Email,Status");
  });

  it("includes only bookings whose session start falls within [from, to], inclusive", async () => {
    const from = DAY_STARTS[0]; // 2026-03-15T08:00:00.000Z
    const to = DAY_STARTS[2]; // 2026-03-15T17:00:00.000Z (inclusive upper bound)
    const res = await exportGet(
      new NextRequest(
        `http://localhost/api/export?type=bookings&from=${from}&to=${to}`,
      ),
    );
    expect(res.status).toBe(200);
    const csv = await res.text();
    const starts = startsOf(csv);
    expect(starts.length).toBeGreaterThan(0);
    // Every emitted row is within the inclusive window.
    for (const start of starts) {
      expect(start >= from).toBe(true);
      expect(start <= to).toBe(true);
    }
    // The 17:00 session is included (inclusive upper bound, not half-open).
    expect(starts).toContain(to);
    // The next-day 08:00 session is excluded.
    expect(starts).not.toContain(DAY_STARTS[3]);
  });

  it("includes the lower-bound session exactly at `from`", async () => {
    const from = DAY_STARTS[0];
    const to = DAY_STARTS[0];
    const res = await exportGet(
      new NextRequest(`http://localhost/api/export?type=bookings&from=${from}&to=${to}`),
    );
    expect(res.status).toBe(200);
    const starts = startsOf(await res.text());
    for (const start of starts) expect(start).toBe(from);
    expect(starts.length).toBeGreaterThan(0);
  });

  it("treats an omitted bound as unbounded on that side", async () => {
    // Only `from` — everything from 2026-03-16 onward (no upper bound).
    const from = DAY_STARTS[3];
    const res = await exportGet(
      new NextRequest(`http://localhost/api/export?type=bookings&from=${from}`),
    );
    expect(res.status).toBe(200);
    const starts = startsOf(await res.text());
    expect(starts.length).toBeGreaterThan(0);
    for (const start of starts) expect(start >= from).toBe(true);
  });

  it("returns 400 on an invalid `from` ISO timestamp", async () => {
    const res = await exportGet(
      new NextRequest("http://localhost/api/export?type=bookings&from=not-a-date"),
    );
    expect(res.status).toBe(400);
  });

  it("quotes a member name containing a comma end-to-end", async () => {
    // Add a member with a comma in their name and a booking on a known session,
    // then confirm the CSV keeps them as a single quoted column.
    const studio = await repos.studios.getFirst();
    if (!studio) throw new Error("seed studio missing");
    const member = await repos.members.insert({
      id: "00000000-0000-4000-8000-00000000beef",
      studioId: studio.id,
      name: "Rossi, Chiara",
      email: "chiara.r@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const sessions = await repos.classSessions.listByStudio(studio.id);
    const target = sessions.find((s) => s.startsAt === DAY_STARTS[1]);
    if (!target) throw new Error("target session missing");
    await repos.bookings.insert({
      id: "00000000-0000-4000-8000-00000000f00d",
      sessionId: target.id,
      memberId: member.id,
      status: "booked",
      bookedAt: "2026-03-14T00:00:00.000Z",
      cancelledAt: null,
    });

    const from = DAY_STARTS[1];
    const to = DAY_STARTS[1];
    const res = await exportGet(
      new NextRequest(`http://localhost/api/export?type=bookings&from=${from}&to=${to}`),
    );
    expect(res.status).toBe(200);
    const csv = await res.text();
    const row = parseRows(csv).find((line) => line.includes("Rossi"));
    expect(row).toBeDefined();
    expect(row).toContain('"Rossi, Chiara"');
  });
});
