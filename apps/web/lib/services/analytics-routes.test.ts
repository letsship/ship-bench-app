import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/bookings/[id]/route";
import { POST } from "@/app/api/bookings/route";
import { createFakeTracker, type FakeTracker } from "@/lib/analytics/fake-tracker";
import { __setTestTracker } from "@/lib/analytics/tracker";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "op@studiobook.test" }),
}));

// This suite proves the __setTestTracker seam works end-to-end: driving the
// real POST/DELETE route handlers with a recording tracker injected in place
// of a live PostHog client.

// Anchored to the real clock: the booking rules compare against `new Date()`
// inside the services, so fixtures must be genuinely future (see
// services.test.ts).
const NOW = new Date();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

function seed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: {
      id: "s1",
      name: "S",
      slug: "s",
      timezone: "Europe/Amsterdam",
      createdAt: NOW.toISOString(),
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
    members: [
      {
        id: "m1",
        studioId: "s1",
        name: "Amara",
        email: "amara@example.com",
        phone: "+15551234567",
        status: "active",
        notificationsOptedOut: false,
        createdAt: NOW.toISOString(),
      },
      {
        id: "m2",
        studioId: "s1",
        name: "Beno",
        email: "beno@example.com",
        phone: null,
        status: "active",
        notificationsOptedOut: false,
        createdAt: NOW.toISOString(),
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
        createdAt: NOW.toISOString(),
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
        capacity: 1,
        priceCents: 1000,
        status: "scheduled",
        createdAt: NOW.toISOString(),
      },
    ],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

describe("booking route handlers (against injected repositories + tracker)", () => {
  let tracker: FakeTracker;

  const previousFakeBackends = process.env.USE_FAKE_BACKENDS;

  beforeEach(() => {
    tracker = createFakeTracker();
    __setTestTracker(tracker);
    // The route handlers build their own notification provider via
    // createNotificationProvider(), which needs fake backends to avoid
    // requiring a real RESEND_API_KEY in tests.
    process.env.USE_FAKE_BACKENDS = "1";
  });

  afterEach(() => {
    __setTestRepositories(null);
    __setTestTracker(null);
    process.env.USE_FAKE_BACKENDS = previousFakeBackends;
  });

  it("POST /api/bookings captures booking_created for a confirmed booking", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));
    const res = await POST(
      new NextRequest("http://localhost/api/bookings", {
        method: "POST",
        body: JSON.stringify({ sessionId: "cs1", memberId: "m1" }),
      }),
    );
    expect(res.status).toBe(201);
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toMatchObject({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "cs1" },
    });
  });

  it("POST /api/bookings captures waitlist_joined for a full session, not booking_created", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        seed({
          bookings: [
            {
              id: "b1",
              sessionId: "cs1",
              memberId: "m1",
              status: "booked",
              bookedAt: NOW.toISOString(),
              cancelledAt: null,
            },
          ],
        }),
      ),
    );
    const res = await POST(
      new NextRequest("http://localhost/api/bookings", {
        method: "POST",
        body: JSON.stringify({ sessionId: "cs1", memberId: "m2" }),
      }),
    );
    expect(res.status).toBe(201);
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toMatchObject({
      distinctId: "m2",
      event: "waitlist_joined",
      properties: { session_id: "cs1" },
    });
  });

  it("DELETE /api/bookings/:id captures booking_cancelled attributed to the member", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        seed({
          bookings: [
            {
              id: "b1",
              sessionId: "cs1",
              memberId: "m1",
              status: "booked",
              bookedAt: NOW.toISOString(),
              cancelledAt: null,
            },
          ],
        }),
      ),
    );
    const res = await DELETE(
      new Request("http://localhost/api/bookings/b1", { method: "DELETE" }),
      {
        params: Promise.resolve({ id: "b1" }),
      },
    );
    expect(res.status).toBe(200);
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toMatchObject({
      distinctId: "m1",
      event: "booking_cancelled",
      properties: { session_id: "cs1" },
    });
  });
});
