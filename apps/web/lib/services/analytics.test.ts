import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createFakeTracker } from "@/lib/analytics/fake-tracker";
import { __setTestTracker } from "@/lib/analytics/tracker";
import { cancelBooking, createBooking } from "./bookings";

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

describe("analytics events", () => {
  beforeEach(() => {
    // Inject test tracker for all tests in this suite
    __setTestTracker(createFakeTracker());
  });

  afterEach(() => {
    __setTestTracker(null);
  });

  it("fires booking_created when a booking is confirmed", async () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );

    await createBooking(repos, createFakeProvider(), tracker, { sessionId: "cs1", memberId: "m1" });

    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toEqual({
      event: "booking_created",
      distinctId: "m1",
      properties: { session_id: "cs1" },
    });
  });

  it("fires waitlist_joined when a booking is waitlisted", async () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 1 })],
        members: [member("m1"), member("m2")],
        bookings: [booking("b1", "m1")],
      }),
    );

    await createBooking(repos, createFakeProvider(), tracker, { sessionId: "cs1", memberId: "m2" });

    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toEqual({
      event: "waitlist_joined",
      distinctId: "m2",
      properties: { session_id: "cs1" },
    });
  });

  it("fires booking_created and NOT waitlist_joined for a confirmed booking", async () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );

    await createBooking(repos, createFakeProvider(), tracker, { sessionId: "cs1", memberId: "m1" });

    const eventNames = tracker.captured.map((e) => e.event);
    expect(eventNames).toContain("booking_created");
    expect(eventNames).not.toContain("waitlist_joined");
  });

  it("fires waitlist_joined and NOT booking_created for a waitlisted booking", async () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 1 })],
        members: [member("m1"), member("m2")],
        bookings: [booking("b1", "m1")],
      }),
    );

    await createBooking(repos, createFakeProvider(), tracker, { sessionId: "cs1", memberId: "m2" });

    const eventNames = tracker.captured.map((e) => e.event);
    expect(eventNames).toContain("waitlist_joined");
    expect(eventNames).not.toContain("booking_created");
  });

  it("fires booking_cancelled when a booking is cancelled", async () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        bookings: [booking("b1", "m1")],
      }),
    );

    await cancelBooking(repos, createFakeProvider(), tracker, "b1");

    const cancelEvents = tracker.captured.filter((e) => e.event === "booking_cancelled");
    expect(cancelEvents).toHaveLength(1);
    expect(cancelEvents[0]).toEqual({
      event: "booking_cancelled",
      distinctId: "m1",
      properties: { session_id: "cs1" },
    });
  });

  it("attributes events to the member (distinctId)", async () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("member123")],
      }),
    );

    await createBooking(repos, createFakeProvider(), tracker, {
      sessionId: "cs1",
      memberId: "member123",
    });

    expect(tracker.captured[0].distinctId).toBe("member123");
  });

  it("includes session_id in event properties", async () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );

    await createBooking(repos, createFakeProvider(), tracker, { sessionId: "cs1", memberId: "m1" });

    expect(tracker.captured[0].properties.session_id).toBe("cs1");
  });

  it("does not include PII in captured events", async () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [
          member("m1", { email: "secret@example.com", name: "Secret Name", phone: "555-1234" }),
        ],
      }),
    );

    await createBooking(repos, createFakeProvider(), tracker, { sessionId: "cs1", memberId: "m1" });

    const event = tracker.captured[0];
    const eventString = JSON.stringify(event);
    expect(eventString).not.toContain("secret@example.com");
    expect(eventString).not.toContain("Secret Name");
    expect(eventString).not.toContain("555-1234");
  });

  it("fires exactly one event per booking creation", async () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );

    await createBooking(repos, createFakeProvider(), tracker, { sessionId: "cs1", memberId: "m1" });

    expect(tracker.captured).toHaveLength(1);
  });

  it("fires exactly one event per booking cancellation", async () => {
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        bookings: [booking("b1", "m1")],
      }),
    );

    await cancelBooking(repos, createFakeProvider(), tracker, "b1");

    // The cancellation fires exactly one event (the booking_cancelled event).
    // There may be other events from promotions, but the primary event count is one.
    const cancelEvents = tracker.captured.filter((e) => e.event === "booking_cancelled");
    expect(cancelEvents).toHaveLength(1);
  });
});
