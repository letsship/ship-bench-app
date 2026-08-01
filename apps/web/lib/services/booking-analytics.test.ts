import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { POST as bookingsPost } from "@/app/api/bookings/route";
import { type FakeTracker, createFakeTracker } from "@/lib/analytics/fake-tracker";
import { __setTestTracker } from "@/lib/analytics/tracker";
import type { CaptureEvent } from "@/lib/analytics/types";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, Member } from "@/lib/db/types";

// The funnel events are asserted through the real route handlers: the
// recording tracker is injected via the __setTestTracker composition-root
// seam, exactly as fakes are injected via __setTestRepositories.

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "operator@studiobook.dev" }),
}));

// Anchored to the real clock: the booking rules compare against `new Date()`
// inside the services, so fixtures must be genuinely in the future.
const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

// Members carry realistic personal data so the no-PII assertions are
// meaningful — none of these strings may appear in a captured event.
const PII = [
  "Amara Okafor",
  "amara@example.com",
  "Jonas Visser",
  "jonas@example.com",
  "+31612345678",
];

const member = (id: string, name: string, email: string): Member => ({
  id,
  studioId: "s1",
  name,
  email,
  phone: "+31612345678",
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
});

const session = (over: Partial<ClassSession> = {}): ClassSession => ({
  id: "cs1",
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

function seed(over: Partial<SeedData> = {}): SeedData {
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
    members: [
      member("m1", "Amara Okafor", "amara@example.com"),
      member("m2", "Jonas Visser", "jonas@example.com"),
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
        createdAt: ISO,
      },
    ],
    sessions: [session()],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

function postBooking(memberId: string): Promise<Response> {
  return bookingsPost(
    new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "cs1", memberId }),
    }),
  );
}

function deleteBooking(id: string): Promise<Response> {
  return bookingDelete(new Request(`http://localhost/api/bookings/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

function expectNoPii(events: CaptureEvent[]): void {
  const serialized = JSON.stringify(events);
  for (const value of PII) expect(serialized).not.toContain(value);
}

describe("booking funnel analytics (through the route handlers)", () => {
  let tracker: FakeTracker;

  beforeEach(() => {
    // Fake backends keep the notification provider hermetic; the injected
    // repositories and tracker below still take precedence over the fakes.
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    tracker = createFakeTracker();
    __setTestTracker(tracker);
  });
  afterEach(() => {
    __setTestTracker(null);
    __setTestRepositories(null);
    vi.unstubAllEnvs();
  });

  it("captures booking_created exactly once for a confirmed booking", async () => {
    __setTestRepositories(createInMemoryRepositories(seed()));
    const res = await postBooking("m1");
    expect(res.status).toBe(201);
    expect(((await res.json()) as { status: string }).status).toBe("booked");
    expect(tracker.captured).toEqual([
      { distinctId: "m1", event: "booking_created", properties: { session_id: "cs1" } },
    ]);
    expectNoPii(tracker.captured);
  });

  it("captures waitlist_joined (and NOT booking_created) when the session is full", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        seed({ sessions: [session({ capacity: 1 })], bookings: [booking("b1", "m1")] }),
      ),
    );
    const res = await postBooking("m2");
    expect(res.status).toBe(201);
    expect(((await res.json()) as { status: string }).status).toBe("waitlisted");
    expect(tracker.captured).toEqual([
      { distinctId: "m2", event: "waitlist_joined", properties: { session_id: "cs1" } },
    ]);
    expectNoPii(tracker.captured);
  });

  it("captures booking_cancelled exactly once on cancellation", async () => {
    __setTestRepositories(createInMemoryRepositories(seed({ bookings: [booking("b1", "m1")] })));
    const res = await deleteBooking("b1");
    expect(res.status).toBe(200);
    expect(tracker.captured).toEqual([
      { distinctId: "m1", event: "booking_cancelled", properties: { session_id: "cs1" } },
    ]);
    expectNoPii(tracker.captured);
  });

  it("does not capture booking_created when a cancellation promotes the waitlist", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        seed({
          sessions: [session({ capacity: 1 })],
          bookings: [booking("b1", "m1"), booking("b2", "m2", { status: "waitlisted" })],
        }),
      ),
    );
    const res = await deleteBooking("b1");
    expect(res.status).toBe(200);
    expect((await res.json()) as { promotedMemberId: string | null }).toMatchObject({
      promotedMemberId: "m2",
    });
    expect(tracker.captured).toEqual([
      { distinctId: "m1", event: "booking_cancelled", properties: { session_id: "cs1" } },
    ]);
  });

  it("captures nothing when a booking is rejected", async () => {
    __setTestRepositories(createInMemoryRepositories(seed({ bookings: [booking("b1", "m1")] })));
    const res = await postBooking("m1");
    expect(res.status).toBe(409);
    expect(tracker.captured).toEqual([]);
  });
});
