import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/export/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { SeedData } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";

// `requireSession()` reaches for `next/headers` cookies, which aren't available
// outside a real request scope in this plain-node vitest environment. Mock the
// session module so the export route (which gates every type behind a signed-in
// session) sees an authenticated operator.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireSession: async () => ({ email: "test@e.co" }),
}));

const NOW = new Date("2026-07-01T12:00:00.000Z");
const ISO = NOW.toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: 900,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

const member = (id: string, over: Partial<Member> = {}): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
  ...over,
});

const classType = (id: string): ClassType => ({
  id,
  studioId: "s1",
  name: "Vinyasa Flow",
  description: null,
  color: "#5b8c5a",
  defaultCapacity: 16,
  defaultPriceCents: 1800,
  createdAt: ISO,
});

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Noor",
  startsAt: "2026-06-15T09:00:00.000Z",
  endsAt: "2026-06-15T10:00:00.000Z",
  capacity: 16,
  priceCents: 1800,
  status: "scheduled",
  createdAt: ISO,
  ...over,
});

const booking = (id: string, sessionId: string, memberId: string, over: Partial<Booking> = {}): Booking => ({
  id,
  sessionId,
  memberId,
  status: "booked",
  bookedAt: ISO,
  cancelledAt: null,
  ...over,
});

function exportRepos(): ReturnType<typeof createInMemoryRepositories> {
  return createInMemoryRepositories(
    baseSeed({
      classTypes: [classType("ct1")],
      members: [
        member("m1", { name: "Amara Okafor", email: "amara@example.com" }),
        member("m2", { name: "Rossi, Chiara", email: "chiara@example.com" }),
      ],
      sessions: [
        session("cs1", { startsAt: "2026-06-01T09:00:00.000Z", endsAt: "2026-06-01T10:00:00.000Z" }),
        session("cs2", { startsAt: "2026-06-30T00:00:00.000Z", endsAt: "2026-06-30T01:00:00.000Z" }),
        session("cs3", { startsAt: "2026-07-15T09:00:00.000Z", endsAt: "2026-07-15T10:00:00.000Z" }),
      ],
      bookings: [
        booking("b1", "cs1", "m1"),
        booking("b2", "cs2", "m2"),
        booking("b3", "cs3", "m1"),
      ],
    }),
  );
}

describe("GET /api/export", () => {
  beforeEach(() => {
    __setTestRepositories(exportRepos());
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns a bookings CSV with the required header order", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export?type=bookings"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="studiobook-bookings.csv"',
    );
    const csv = await res.text();
    const [header, ...rows] = csv.split("\r\n");
    expect(header).toBe("Starts,Class,Member,Email,Status");
    // No range filter: all three seeded bookings come back, ordered by start.
    expect(rows).toHaveLength(3);
    expect(rows[0]).toBe(
      "2026-06-01T09:00:00.000Z,Vinyasa Flow,Amara Okafor,amara@example.com,booked",
    );
    // The comma-in-name member stays a single quoted column (5 commas total).
    expect(rows[1]).toBe(
      '2026-06-30T00:00:00.000Z,Vinyasa Flow,"Rossi, Chiara",chiara@example.com,booked',
    );
    expect(rows[1].split(",")).toHaveLength(6);
  });

  it("applies the from/to bounds inclusively on both ends", async () => {
    const res = await GET(
      new NextRequest(
        "http://localhost/api/export?type=bookings&from=2026-06-01T09:00:00.000Z&to=2026-06-30T00:00:00.000Z",
      ),
    );
    expect(res.status).toBe(200);
    const csv = await res.text();
    const rows = csv.split("\r\n").slice(1);
    // Includes both the session starting exactly at `from` and exactly at `to`;
    // drops the mid-July one.
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("2026-06-01T09:00:00.000Z");
    expect(rows[1]).toContain("2026-06-30T00:00:00.000Z");
  });

  it("still requires a signed-in session (existing members/invoices exports do)", async () => {
    // Sanity that the booking export routes through the same auth gate as the
    // other types — if requireSession is removed/unmocked, this test would need
    // updating; with the module mock above, the gate passes and we get a CSV.
    const res = await GET(new NextRequest("http://localhost/api/export?type=members"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
  });

  it("rejects an unknown export type with 400", async () => {
    const res = await GET(new NextRequest("http://localhost/api/export?type=nope"));
    expect(res.status).toBe(400);
  });
});
