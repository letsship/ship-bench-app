import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as bookingsDelete } from "@/app/api/bookings/[id]/route";
import { POST as bookingsPost } from "@/app/api/bookings/route";
import { __setTestTracker } from "@/lib/analytics";
import { createFakeTracker } from "@/lib/analytics/fake-tracker";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "op@e.co" }),
}));

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
  name: id,
  email: `${id}@e.co`,
  phone: "+15551234567",
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

function postBooking(sessionId: string, memberId: string): Promise<Response> {
  return bookingsPost(
    new NextRequest("http://localhost/api/bookings", {
      method: "POST",
      body: JSON.stringify({ sessionId, memberId }),
    }),
  );
}

function deleteBooking(id: string): Promise<Response> {
  return bookingsDelete(new NextRequest("http://localhost/api/bookings/" + id), {
    params: Promise.resolve({ id }),
  });
}

const noPii = (properties: Record<string, unknown>): void => {
  const serialized = JSON.stringify(properties).toLowerCase();
  expect(serialized).not.toContain("@e.co");
  expect(serialized).not.toContain("+1555");
  expect(properties).not.toHaveProperty("email");
  expect(properties).not.toHaveProperty("name");
  expect(properties).not.toHaveProperty("phone");
};

describe("booking funnel analytics (route handlers + injected tracker)", () => {
  let tracker: ReturnType<typeof createFakeTracker>;

  beforeEach(() => {
    // Route handlers also resolve a notification provider; fake backends mode
    // gives them the in-memory recorder instead of requiring RESEND_API_KEY.
    process.env.USE_FAKE_BACKENDS = "1";
    tracker = createFakeTracker();
    __setTestTracker(tracker);
  });

  afterEach(() => {
    __setTestTracker(null);
    __setTestRepositories(null);
    delete process.env.USE_FAKE_BACKENDS;
  });

  it("fires exactly one booking_created (and no waitlist_joined) for a confirmed booking", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [member("m1")],
        }),
      ),
    );

    const res = await postBooking("cs1", "m1");
    expect(res.status).toBe(201);

    const names = tracker.captured.map((e) => e.event);
    expect(names).toEqual(["booking_created"]);
    expect(names).not.toContain("waitlist_joined");

    const [captured] = tracker.captured;
    expect(captured.distinctId).toBe("m1");
    expect(captured.properties).toEqual({ session_id: "cs1" });
    noPii(captured.properties);
  });

  it("fires exactly one waitlist_joined (and no booking_created) for a full session", async () => {
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

    const names = tracker.captured.map((e) => e.event);
    expect(names).toEqual(["waitlist_joined"]);
    expect(names).not.toContain("booking_created");

    const [captured] = tracker.captured;
    expect(captured.distinctId).toBe("m2");
    expect(captured.properties).toEqual({ session_id: "cs1" });
    noPii(captured.properties);
  });

  it("fires exactly one booking_cancelled on cancellation", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [member("m1")],
          bookings: [booking("b1", "m1")],
        }),
      ),
    );

    const res = await deleteBooking("b1");
    expect(res.status).toBe(200);

    const names = tracker.captured.map((e) => e.event);
    expect(names).toEqual(["booking_cancelled"]);

    const [captured] = tracker.captured;
    expect(captured.distinctId).toBe("m1");
    expect(captured.properties).toEqual({ session_id: "cs1" });
    noPii(captured.properties);
  });
});
