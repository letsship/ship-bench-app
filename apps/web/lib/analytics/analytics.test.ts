import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createBooking, cancelBooking } from "@/lib/services/bookings";
import { __setTestTracker } from "./index";
import { createFakeTracker } from "./fake-tracker";

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

describe("analytics tracker", () => {
  let tracker = createFakeTracker();

  beforeEach(() => {
    tracker = createFakeTracker();
    __setTestTracker(tracker);
  });

  afterEach(() => {
    __setTestTracker(null);
  });

  it("captures booking_created when a booking is confirmed", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );
    const provider = createFakeProvider();

    const result = await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });

    expect(result.status).toBe("booked");
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0].event).toBe("booking_created");
    expect(tracker.captured[0].distinctId).toBe("m1");
    expect(tracker.captured[0].properties?.session_id).toBe("cs1");
  });

  it("captures waitlist_joined when a booking is waitlisted", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 1 })],
        members: [member("m1"), member("m2")],
        bookings: [booking("b1", "m1")],
      }),
    );
    const provider = createFakeProvider();

    const result = await createBooking(repos, provider, { sessionId: "cs1", memberId: "m2" });

    expect(result.status).toBe("waitlisted");
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0].event).toBe("waitlist_joined");
    expect(tracker.captured[0].distinctId).toBe("m2");
    expect(tracker.captured[0].properties?.session_id).toBe("cs1");
  });

  it("captures booking_created and NOT waitlist_joined for confirmed bookings", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );
    const provider = createFakeProvider();

    await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });

    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0].event).toBe("booking_created");
    expect(tracker.captured.some((e) => e.event === "waitlist_joined")).toBe(false);
  });

  it("captures waitlist_joined and NOT booking_created for waitlisted bookings", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 1 })],
        members: [member("m1"), member("m2")],
        bookings: [booking("b1", "m1")],
      }),
    );
    const provider = createFakeProvider();

    await createBooking(repos, provider, { sessionId: "cs1", memberId: "m2" });

    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0].event).toBe("waitlist_joined");
    expect(tracker.captured.some((e) => e.event === "booking_created")).toBe(false);
  });

  it("captures booking_cancelled when a booking is cancelled", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        bookings: [booking("b1", "m1")],
      }),
    );
    const provider = createFakeProvider();

    await cancelBooking(repos, provider, "b1");

    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0].event).toBe("booking_cancelled");
    expect(tracker.captured[0].distinctId).toBe("m1");
    expect(tracker.captured[0].properties?.session_id).toBe("cs1");
  });

  it("attributes events to the member via distinctId", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );
    const provider = createFakeProvider();

    await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });

    expect(tracker.captured[0].distinctId).toBe("m1");
  });

  it("includes session_id in event properties", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );
    const provider = createFakeProvider();

    await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });

    expect(tracker.captured[0].properties?.session_id).toBe("cs1");
  });

  it("does not include PII (email, name, phone) in event properties", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );
    const provider = createFakeProvider();

    await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });

    const event = tracker.captured[0];
    const propertiesStr = JSON.stringify(event.properties);
    expect(propertiesStr).not.toContain("m1@e.co");
    expect(propertiesStr).not.toContain("m1");
  });
});
