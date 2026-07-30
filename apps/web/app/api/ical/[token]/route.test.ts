import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/ical/[token]/route";
import { __setTestRepositories, resolveRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";

// The route filters with `new Date()`, so fixtures must be genuinely
// future/past relative to the real clock — same approach as services.test.ts.
const NOW = new Date();
const ISO = NOW.toISOString();
const DAY_MS = 86_400_000;
const PAST = new Date(NOW.getTime() - 5 * DAY_MS).toISOString();
const PAST_END = new Date(NOW.getTime() - 5 * DAY_MS + 3_600_000).toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * DAY_MS).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * DAY_MS + 3_600_000).toISOString();

const member = (id: string, token: string): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  icalToken: token,
  createdAt: ISO,
});

const classType = (id: string): ClassType => ({
  id,
  studioId: "s1",
  name: `Yoga ${id}`,
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: ISO,
});

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Noor",
  startsAt: FUTURE,
  endsAt: FUTURE_END,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
  ...over,
});

const booking = (id: string, memberId: string, over: Partial<Booking> = {}): Booking => ({
  id,
  sessionId: "cs-future",
  memberId,
  status: "booked",
  bookedAt: ISO,
  cancelledAt: null,
  ...over,
});

function seed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: {
      id: "s1",
      name: "Riverbank Movement",
      slug: "s",
      timezone: "Europe/Amsterdam",
      createdAt: ISO,
    },
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
    members: [member("m1", "token-m1"), member("m2", "token-m2")],
    classTypes: [classType("ct1")],
    sessions: [session("cs-future"), session("cs-past", { startsAt: PAST, endsAt: PAST_END })],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

function requestFor(token: string): NextRequest {
  return new NextRequest(`http://localhost/api/ical/${token}`);
}

describe("GET /api/ical/[token]", () => {
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns 200 + text/calendar with only the member's upcoming booked session", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        seed({
          bookings: [
            booking("b-future", "m1"),
            booking("b-past", "m1", { sessionId: "cs-past" }),
            booking("b-other", "m2"),
          ],
        }),
      ),
    );
    const res = await GET(requestFor("token-m1"), { params: Promise.resolve({ token: "token-m1" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("UID:cs-future@studiobook");
    expect(body).toContain("SUMMARY:Yoga ct1");
    expect(body).not.toContain("cs-past");
  });

  it("returns 404 for an unknown token", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));
    const res = await GET(requestFor("no-such-token"), {
      params: Promise.resolve({ token: "no-such-token" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for an empty token", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));
    const res = await GET(requestFor(""), { params: Promise.resolve({ token: "" }) });
    expect(res.status).toBe(404);
  });

  it("does not require a session cookie (token alone authorizes)", async () => {
    __setTestRepositories(
      createInMemoryRepositories(seed({ bookings: [booking("b-future", "m1")] })),
    );
    const req = new NextRequest(`http://localhost/api/ical/token-m1`);
    // No Cookie header set; the request must still succeed.
    expect(req.headers.get("cookie")).toBeNull();
    const res = await GET(req, { params: Promise.resolve({ token: "token-m1" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
  });

  it("serves the seeded dataset for a known member's token", async () => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(new Date())));
    const repos = await resolveRepositories();
    const studio = await repos.studios.getFirst();
    const members = await repos.members.listByStudio(studio!.id);
    const first = members[0];
    const res = await GET(requestFor(first.icalToken), {
      params: Promise.resolve({ token: first.icalToken }),
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });
});
