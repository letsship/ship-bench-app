import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as bookingsDelete } from "@/app/api/bookings/[id]/route";
import { POST as bookingsPost } from "@/app/api/bookings/route";
import { createFakeTracker } from "@/lib/analytics/fake-tracker";
import { __setTestTracker } from "@/lib/analytics/tracker";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => ({ email: "op@e.co" })),
}));

// Anchored to the real clock: the booking/cancellation rules compare against
// `new Date()` inside the services, so fixtures must be genuinely future/past.
const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

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
  name: `Member ${id}`,
  email: `${id}@example.com`,
  phone: `+1-555-${id}`,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
  ...over,
});

const classType = (id: string): ClassType => ({
  id,
  studioId: "s1",
  name: "Yoga",
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

// Any event's properties, serialized, must never contain a seeded email, name,
// or phone value.
function assertNoPii(properties: Record<string, unknown> | undefined): void {
  const serialized = JSON.stringify(properties ?? {});
  expect(serialized).not.toContain("@example.com");
  expect(serialized).not.toContain("Member ");
  expect(serialized).not.toContain("+1-555-");
}

function postBooking(sessionId: string, memberId: string): Promise<Response> {
  return bookingsPost(
    new NextRequest("http://localhost/api/bookings", {
      method: "POST",
      body: JSON.stringify({ sessionId, memberId }),
    }),
  );
}

function deleteBooking(bookingId: string): Promise<Response> {
  return bookingsDelete(new Request("http://localhost/api/bookings/x", { method: "DELETE" }), {
    params: Promise.resolve({ id: bookingId }),
  });
}

describe("booking funnel analytics (driven through the route handlers)", () => {
  let tracker: ReturnType<typeof createFakeTracker>;

  beforeEach(() => {
    // The route handlers also resolve a notification provider; fake backends
    // avoids requiring a real RESEND_API_KEY in this test.
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    tracker = createFakeTracker();
    __setTestTracker(tracker);
  });

  afterEach(() => {
    __setTestRepositories(null);
    __setTestTracker(null);
    vi.unstubAllEnvs();
  });

  it("records exactly one booking_created (and no waitlist_joined) for a confirmed booking", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1", { capacity: 5 })],
          members: [member("m1")],
        }),
      ),
    );

    const res = await postBooking("cs1", "m1");
    expect(res.status).toBe(201);

    expect(tracker.captured.map((e) => e.event)).toEqual(["booking_created"]);
    const [captured] = tracker.captured;
    expect(captured.distinctId).toBe("m1");
    expect(captured.properties).toEqual({ session_id: "cs1" });
    assertNoPii(captured.properties);
  });

  it("records exactly one waitlist_joined (and no booking_created) for a full session", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1", { capacity: 1 })],
          members: [member("m1"), member("m2")],
          bookings: [booking("b1", "m1")],
        }),
      ),
    );

    const res = await postBooking("cs1", "m2");
    expect(res.status).toBe(201);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("waitlisted");

    expect(tracker.captured.map((e) => e.event)).toEqual(["waitlist_joined"]);
    const [captured] = tracker.captured;
    expect(captured.distinctId).toBe("m2");
    expect(captured.properties).toEqual({ session_id: "cs1" });
    assertNoPii(captured.properties);
  });

  it("records exactly one booking_cancelled on cancellation", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1", { capacity: 5 })],
          members: [member("m1")],
          bookings: [booking("b1", "m1")],
        }),
      ),
    );

    const res = await deleteBooking("b1");
    expect(res.status).toBe(200);

    expect(tracker.captured.map((e) => e.event)).toEqual(["booking_cancelled"]);
    const [captured] = tracker.captured;
    expect(captured.distinctId).toBe("m1");
    expect(captured.properties).toEqual({ session_id: "cs1" });
    assertNoPii(captured.properties);
  });
});
