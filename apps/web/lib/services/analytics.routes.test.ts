import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Use fake backends so createNotificationProvider returns the in-memory fake.
vi.stubEnv("USE_FAKE_BACKENDS", "1");
import { POST } from "@/app/api/bookings/route";
import { DELETE } from "@/app/api/bookings/[id]/route";
import { __setTestTracker } from "@/lib/analytics/tracker";
import { createFakeTracker } from "@/lib/analytics/fake-tracker";
import type { RecordingTracker } from "@/lib/analytics/fake-tracker";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, Member } from "@/lib/db/types";

// Mock auth so route handlers don't fail on missing cookie.
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "test@example.com" }),
  getSession: vi.fn().mockResolvedValue({ email: "test@example.com" }),
}));

const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

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

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "I",
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
  sessionId: "cs1",
  memberId,
  status: "booked",
  bookedAt: ISO,
  cancelledAt: null,
  ...over,
});

// PII keys that must never appear in any captured event's properties.
const PII_KEYS = ["email", "name", "phone", "memberEmail", "memberName", "memberPhone"];

function expectNoPii(tracker: RecordingTracker): void {
  for (const ev of tracker.captured) {
    for (const key of Object.keys(ev.properties)) {
      expect(PII_KEYS).not.toContain(key);
    }
  }
}

describe("POST /api/bookings — analytics events", () => {
  let tracker: RecordingTracker;

  beforeEach(() => {
    tracker = createFakeTracker();
    __setTestTracker(tracker);
  });

  afterEach(() => {
    __setTestTracker(null);
    __setTestRepositories(null);
  });

  it("captures one booking_created when a seat is available", async () => {
    __setTestRepositories(
      createInMemoryRepositories({
        studio: { id: "s1", name: "S", slug: "s", timezone: "UTC", createdAt: ISO },
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
        members: [member("m1")],
        classTypes: [{ id: "ct1", studioId: "s1", name: "Yoga", description: null, color: "#000", defaultCapacity: 10, defaultPriceCents: 1000, createdAt: ISO }],
        sessions: [session("cs1")],
        bookings: [],
        invoices: [],
        lineItems: [],
        outbox: [],
      }),
    );

    const res = await POST(
      new NextRequest("http://localhost/api/bookings", {
        method: "POST",
        body: JSON.stringify({ sessionId: "cs1", memberId: "m1" }),
      }),
    );
    expect(res.status).toBe(201);

    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0].event).toBe("booking_created");
    expect(tracker.captured[0].distinctId).toBe("m1");
    expect(tracker.captured[0].properties).toEqual({ session_id: "cs1" });
    expectNoPii(tracker);
  });

  it("captures one waitlist_joined (not booking_created) when full", async () => {
    __setTestRepositories(
      createInMemoryRepositories({
        studio: { id: "s1", name: "S", slug: "s", timezone: "UTC", createdAt: ISO },
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
        members: [member("m1"), member("m2")],
        classTypes: [{ id: "ct1", studioId: "s1", name: "Yoga", description: null, color: "#000", defaultCapacity: 10, defaultPriceCents: 1000, createdAt: ISO }],
        sessions: [session("cs1", { capacity: 1 })],
        bookings: [booking("b1", "m1")],
        invoices: [],
        lineItems: [],
        outbox: [],
      }),
    );

    const res = await POST(
      new NextRequest("http://localhost/api/bookings", {
        method: "POST",
        body: JSON.stringify({ sessionId: "cs1", memberId: "m2" }),
      }),
    );
    expect(res.status).toBe(201);

    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0].event).toBe("waitlist_joined");
    expect(tracker.captured[0].distinctId).toBe("m2");
    expect(tracker.captured[0].properties).toEqual({ session_id: "cs1" });
    expectNoPii(tracker);
  });
});

describe("DELETE /api/bookings/:id — analytics events", () => {
  let tracker: RecordingTracker;

  beforeEach(() => {
    tracker = createFakeTracker();
    __setTestTracker(tracker);
  });

  afterEach(() => {
    __setTestTracker(null);
    __setTestRepositories(null);
  });

  it("captures one booking_cancelled when a booking is cancelled", async () => {
    __setTestRepositories(
      createInMemoryRepositories({
        studio: { id: "s1", name: "S", slug: "s", timezone: "UTC", createdAt: ISO },
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
        members: [member("m1")],
        classTypes: [{ id: "ct1", studioId: "s1", name: "Yoga", description: null, color: "#000", defaultCapacity: 10, defaultPriceCents: 1000, createdAt: ISO }],
        sessions: [session("cs1")],
        bookings: [booking("b1", "m1")],
        invoices: [],
        lineItems: [],
        outbox: [],
      }),
    );

    const res = await DELETE(
      new NextRequest("http://localhost/api/bookings/b1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "b1" }) },
    );
    expect(res.status).toBe(200);

    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0].event).toBe("booking_cancelled");
    expect(tracker.captured[0].distinctId).toBe("m1");
    expect(tracker.captured[0].properties).toEqual({ session_id: "cs1" });
    expectNoPii(tracker);
  });
});