import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createFakeTracker } from "./fake-tracker";
import { __setTestTracker } from "./tracker";
import { createBooking, cancelBooking } from "@/lib/services/bookings";
import { BOOKING_CREATED, BOOKING_CANCELLED, WAITLIST_JOINED } from "./types";

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
  phone: null,
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

describe("booking funnel analytics events", () => {
  let repos: Repositories;
  let tracker: ReturnType<typeof createFakeTracker>;

  beforeEach(() => {
    tracker = createFakeTracker();
    __setTestTracker(tracker);
  });

  afterEach(() => {
    __setTestTracker(null);
  });

  it("captures booking_created event when a member books a confirmed seat", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );
    const provider = createFakeProvider();

    await createBooking(repos, provider, tracker, {
      sessionId: "cs1",
      memberId: "m1",
    });

    const bookingCreatedEvents = tracker.captured.filter((e) => e.event === BOOKING_CREATED);
    expect(bookingCreatedEvents).toHaveLength(1);
    const event = bookingCreatedEvents[0];
    expect(event.distinctId).toBe("m1");
    expect(event.properties?.session_id).toBe("cs1");
  });

  it("captures waitlist_joined event when a member is waitlisted", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 1 })],
        members: [member("m1"), member("m2")],
        bookings: [booking("b1", "m1")],
      }),
    );
    const provider = createFakeProvider();

    await createBooking(repos, provider, tracker, {
      sessionId: "cs1",
      memberId: "m2",
    });

    const waitlistEvents = tracker.captured.filter((e) => e.event === WAITLIST_JOINED);
    expect(waitlistEvents).toHaveLength(1);
    const event = waitlistEvents[0];
    expect(event.distinctId).toBe("m2");
    expect(event.properties?.session_id).toBe("cs1");
  });

  it("does not fire booking_created for a waitlisted member", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 1 })],
        members: [member("m1"), member("m2")],
        bookings: [booking("b1", "m1")],
      }),
    );
    const provider = createFakeProvider();

    await createBooking(repos, provider, tracker, {
      sessionId: "cs1",
      memberId: "m2",
    });

    const bookingCreatedEvents = tracker.captured.filter((e) => e.event === BOOKING_CREATED);
    expect(bookingCreatedEvents).toHaveLength(0);
  });

  it("does not fire waitlist_joined for a confirmed booking", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );
    const provider = createFakeProvider();

    await createBooking(repos, provider, tracker, {
      sessionId: "cs1",
      memberId: "m1",
    });

    const waitlistEvents = tracker.captured.filter((e) => e.event === WAITLIST_JOINED);
    expect(waitlistEvents).toHaveLength(0);
  });

  it("captures booking_cancelled event when a booking is cancelled", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        bookings: [booking("b1", "m1")],
      }),
    );
    const provider = createFakeProvider();

    await cancelBooking(repos, provider, tracker, "b1");

    const cancelledEvents = tracker.captured.filter((e) => e.event === BOOKING_CANCELLED);
    expect(cancelledEvents).toHaveLength(1);
    const event = cancelledEvents[0];
    expect(event.distinctId).toBe("m1");
    expect(event.properties?.session_id).toBe("cs1");
  });

  it("does not include personally-identifying data (email, name, phone) in event properties", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1", { email: "user@example.com", name: "John Doe" })],
      }),
    );
    const provider = createFakeProvider();

    await createBooking(repos, provider, tracker, {
      sessionId: "cs1",
      memberId: "m1",
    });

    const events = tracker.captured;
    for (const event of events) {
      const propertiesStr = JSON.stringify(event.properties || {});
      expect(propertiesStr).not.toContain("user@example.com");
      expect(propertiesStr).not.toContain("John Doe");
      expect(propertiesStr).not.toContain("john");
      expect(propertiesStr).not.toContain("doe");
    }
  });

  it("captures exactly one event per action", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );
    const provider = createFakeProvider();

    tracker.captured.length = 0;
    await createBooking(repos, provider, tracker, {
      sessionId: "cs1",
      memberId: "m1",
    });
    expect(tracker.captured).toHaveLength(1);
  });
});
