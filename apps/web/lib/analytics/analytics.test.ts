import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { POST as bookingsPost } from "@/app/api/bookings/route";
import { type FakeTracker, createFakeTracker } from "@/lib/analytics/fake-tracker";
import { __setTestTracker } from "@/lib/analytics/tracker";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";

// The route handlers read the operator session via next/headers, which has no
// request scope under vitest. Stub the cookie store with a genuinely signed
// token so the real requireSession verification still runs.
let sessionToken = "";
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === SESSION_COOKIE ? { name, value: sessionToken } : undefined),
  }),
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

// Members carry realistic PII so the no-PII assertion below actually bites.
const member = (id: string, name: string, email: string): Member => ({
  id,
  studioId: "s1",
  name,
  email,
  phone: "+31 6 1234 5678",
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
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

const MEMBERS = [
  member("m1", "Amara Okafor", "amara@example.com"),
  member("m2", "Bram de Vries", "bram@example.com"),
];

function seed(over: Partial<SeedData> = {}): SeedData {
  return baseSeed({ classTypes: [classType("ct1")], members: MEMBERS, ...over });
}

const postBooking = (body: unknown): Promise<Response> =>
  bookingsPost(
    new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const deleteBooking = (id: string): Promise<Response> =>
  bookingDelete(new Request(`http://localhost/api/bookings/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });

const names = (tracker: FakeTracker): string[] => tracker.captured.map((event) => event.name);

describe("booking funnel analytics (route handlers + injected recording tracker)", () => {
  let tracker: FakeTracker;
  let previousFakeBackends: string | undefined;

  beforeAll(async () => {
    sessionToken = await createSessionToken("owner@example.com");
    // The routes build their notification provider from env; fake-backends mode
    // keeps that in-memory. Repos and tracker are injected via the test seams.
    previousFakeBackends = process.env.USE_FAKE_BACKENDS;
    process.env.USE_FAKE_BACKENDS = "1";
  });

  afterAll(() => {
    if (previousFakeBackends === undefined) delete process.env.USE_FAKE_BACKENDS;
    else process.env.USE_FAKE_BACKENDS = previousFakeBackends;
  });

  beforeEach(() => {
    tracker = createFakeTracker();
    __setTestTracker(tracker);
  });

  afterEach(() => {
    __setTestTracker(null);
    __setTestRepositories(null);
  });

  it("captures exactly one booking_created (and no waitlist_joined) for a confirmed booking", async () => {
    __setTestRepositories(createInMemoryRepositories(seed({ sessions: [session("cs1")] })));

    const res = await postBooking({ sessionId: "cs1", memberId: "m1" });

    expect(res.status).toBe(201);
    expect(names(tracker)).toEqual(["booking_created"]);
    expect(tracker.captured[0].distinctId).toBe("m1");
    expect(tracker.captured[0].properties).toEqual({ session_id: "cs1" });
  });

  it("captures exactly one waitlist_joined (and no booking_created) for a full session", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        seed({ sessions: [session("cs1", { capacity: 1 })], bookings: [booking("b1", "m1")] }),
      ),
    );

    const res = await postBooking({ sessionId: "cs1", memberId: "m2" });

    expect(res.status).toBe(201);
    expect(((await res.json()) as { status: string }).status).toBe("waitlisted");
    expect(names(tracker)).toEqual(["waitlist_joined"]);
    expect(tracker.captured[0].distinctId).toBe("m2");
    expect(tracker.captured[0].properties).toEqual({ session_id: "cs1" });
  });

  it("captures exactly one booking_cancelled on cancellation", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        seed({ sessions: [session("cs1")], bookings: [booking("b1", "m1")] }),
      ),
    );

    const res = await deleteBooking("b1");

    expect(res.status).toBe(200);
    expect(names(tracker)).toEqual(["booking_cancelled"]);
    expect(tracker.captured[0].distinctId).toBe("m1");
    expect(tracker.captured[0].properties).toEqual({ session_id: "cs1" });
  });

  it("captures no extra events when a cancellation promotes a waitlisted member", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        seed({
          sessions: [session("cs1", { capacity: 1 })],
          bookings: [booking("b1", "m1"), booking("b2", "m2", { status: "waitlisted" })],
        }),
      ),
    );

    const res = await deleteBooking("b1");

    expect(res.status).toBe(200);
    expect(names(tracker)).toEqual(["booking_cancelled"]);
  });

  it("captures nothing when the booking is denied", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        seed({ sessions: [session("cs1")], bookings: [booking("b1", "m1")] }),
      ),
    );

    const res = await postBooking({ sessionId: "cs1", memberId: "m1" });

    expect(res.status).toBe(409);
    expect(tracker.captured).toHaveLength(0);
  });

  it("never puts email, name, or phone in event properties", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        seed({ sessions: [session("cs1", { capacity: 1 })], bookings: [booking("b1", "m1")] }),
      ),
    );

    await postBooking({ sessionId: "cs1", memberId: "m2" });
    await deleteBooking("b1");

    expect(tracker.captured.length).toBeGreaterThan(0);
    for (const event of tracker.captured) {
      const serialized = JSON.stringify(event.properties);
      expect(serialized).not.toMatch(/@/);
      for (const pii of MEMBERS.flatMap((m) => [m.email, m.name, m.phone ?? ""])) {
        expect(serialized).not.toContain(pii);
      }
    }
  });
});
