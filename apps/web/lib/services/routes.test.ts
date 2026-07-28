import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { POST as bookingsPost } from "@/app/api/bookings/route";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { createFakeTracker } from "@/lib/analytics/fake-tracker";
import { __setTestTracker } from "@/lib/analytics/tracker";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { createSessionToken } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// POST/DELETE call requireSession(), which reads the cookie jar through
// next/headers. Stub the jar with a valid signed session cookie so the
// handlers run past auth in the test environment.
const sessionToken = await createSessionToken("owner@riverbank.studio");
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === SESSION_COOKIE ? { value: sessionToken } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/classes returns sessions with occupancy", async () => {
    const res = await classesGet(new NextRequest("http://localhost/api/classes"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty("occupancy");
  });

  it("GET /api/classes honours a from filter", async () => {
    const res = await classesGet(
      new NextRequest("http://localhost/api/classes?from=2099-01-01T00:00:00.000Z"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("GET /api/invoices returns invoices with a number", async () => {
    const res = await invoicesGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body[0]).toHaveProperty("number");
  });

  it("GET /api/members returns the studio's members", async () => {
    const res = await membersGet();
    expect(res.status).toBe(200);
    expect(((await res.json()) as unknown[]).length).toBeGreaterThan(0);
  });
});

describe("booking mutation routes (with injected recording tracker)", () => {
  // Anchored to the real clock: booking/cancellation rules compare against
  // `new Date()` inside the services, so fixtures must be genuinely future.
  const REAL_NOW = new Date();
  const FUTURE = new Date(REAL_NOW.getTime() + 7 * 86_400_000).toISOString();
  const FUTURE_END = new Date(REAL_NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();
  const STAMP = REAL_NOW.toISOString();

  const seed = () => ({
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: STAMP },
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
    members: [
      {
        id: "m1",
        studioId: "s1",
        name: "A",
        email: "a@e.co",
        phone: null,
        status: "active",
        notificationsOptedOut: false,
        createdAt: STAMP,
      },
      {
        id: "m2",
        studioId: "s1",
        name: "B",
        email: "b@e.co",
        phone: null,
        status: "active",
        notificationsOptedOut: false,
        createdAt: STAMP,
      },
    ],
    classTypes: [
      {
        id: "ct1",
        studioId: "s1",
        name: "Yoga",
        description: null,
        color: "#111111",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        createdAt: STAMP,
      },
    ],
    sessions: [
      {
        id: "cs1",
        studioId: "s1",
        classTypeId: "ct1",
        instructor: "I",
        startsAt: FUTURE,
        endsAt: FUTURE_END,
        capacity: 10,
        priceCents: 1000,
        status: "scheduled",
        createdAt: STAMP,
      },
    ],
    bookings: [
      {
        id: "b1",
        sessionId: "cs1",
        memberId: "m1",
        status: "booked",
        bookedAt: STAMP,
        cancelledAt: null,
      },
    ],
    invoices: [],
    lineItems: [],
    outbox: [],
  });

  let tracker: ReturnType<typeof createFakeTracker>;
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(seed()));
    tracker = createFakeTracker();
    __setTestTracker(tracker);
    process.env.USE_FAKE_BACKENDS = "1";
  });
  afterEach(() => {
    __setTestRepositories(null);
    __setTestTracker(null);
    delete process.env.USE_FAKE_BACKENDS;
  });

  it("POST /api/bookings captures booking_created exactly once", async () => {
    const request = new NextRequest("http://localhost/api/bookings", {
      method: "POST",
      body: JSON.stringify({ sessionId: "cs1", memberId: "m2" }),
      headers: { "content-type": "application/json" },
    });
    const res = await bookingsPost(request);
    expect(res.status).toBe(201);
    expect(tracker.captured).toEqual([
      { distinctId: "m2", event: "booking_created", properties: { session_id: "cs1" } },
    ]);
    expect(JSON.stringify(tracker.captured)).not.toMatch(/email|name|phone|@e\.co/i);
  });

  it("DELETE /api/bookings/:id captures booking_cancelled exactly once", async () => {
    const res = await bookingDelete(new NextRequest("http://localhost/api/bookings/b1"), {
      params: Promise.resolve({ id: "b1" }),
    });
    expect(res.status).toBe(200);
    expect(tracker.captured).toEqual([
      { distinctId: "m1", event: "booking_cancelled", properties: { session_id: "cs1" } },
    ]);
  });
});
