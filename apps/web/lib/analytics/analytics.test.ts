import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createFakeTracker } from "./fake-tracker";
import { __setTestTracker, resolveTracker } from "./tracker";
import { cancelBooking, createBooking } from "@/lib/services/bookings";

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

describe("analytics tracker", () => {
  let repos: Repositories;
  let tracker = createFakeTracker();

  beforeEach(() => {
    tracker = createFakeTracker();
    __setTestTracker(tracker);
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1"), session("cs2", { capacity: 1 })],
        members: [member("m1"), member("m2"), member("m3")],
      }),
    );
  });

  afterEach(() => {
    __setTestTracker(null);
  });

  it("captures booking_created when a booking is confirmed", async () => {
    const provider = createFakeProvider();
    const result = await createBooking(repos, provider, tracker, {
      sessionId: "cs1",
      memberId: "m1",
    });
    expect(result.status).toBe("booked");
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toEqual({
      distinctId: "m1",
      event: "booking_created",
      properties: { session_id: "cs1" },
    });
  });

  it("captures waitlist_joined when a booking is waitlisted", async () => {
    const provider = createFakeProvider();
    const result = await createBooking(repos, provider, tracker, {
      sessionId: "cs2",
      memberId: "m1",
    });
    // First booking fills the seat
    expect(result.status).toBe("booked");

    // Second booking should be waitlisted
    const tracker2 = createFakeTracker();
    __setTestTracker(tracker2);
    const result2 = await createBooking(repos, provider, tracker2, {
      sessionId: "cs2",
      memberId: "m2",
    });
    expect(result2.status).toBe("waitlisted");
    expect(tracker2.captured).toHaveLength(1);
    expect(tracker2.captured[0]).toEqual({
      distinctId: "m2",
      event: "waitlist_joined",
      properties: { session_id: "cs2" },
    });
  });

  it("does not capture booking_created for waitlisted bookings", async () => {
    const provider = createFakeProvider();
    const tracker1 = createFakeTracker();
    __setTestTracker(tracker1);
    await createBooking(repos, provider, tracker1, { sessionId: "cs2", memberId: "m1" });

    const tracker2 = createFakeTracker();
    __setTestTracker(tracker2);
    await createBooking(repos, provider, tracker2, { sessionId: "cs2", memberId: "m2" });
    expect(tracker2.captured[0].event).toBe("waitlist_joined");
    expect(tracker2.captured.filter((e) => e.event === "booking_created")).toHaveLength(0);
  });

  it("does not capture waitlist_joined for confirmed bookings", async () => {
    const provider = createFakeProvider();
    const result = await createBooking(repos, provider, tracker, {
      sessionId: "cs1",
      memberId: "m1",
    });
    expect(result.status).toBe("booked");
    expect(tracker.captured.filter((e) => e.event === "waitlist_joined")).toHaveLength(0);
  });

  it("captures booking_cancelled when a booking is cancelled", async () => {
    const provider = createFakeProvider();
    await createBooking(repos, provider, tracker, { sessionId: "cs1", memberId: "m1" });

    const tracker2 = createFakeTracker();
    __setTestTracker(tracker2);
    // Find the booking ID
    const bookings = await repos.bookings.listBySession("cs1");
    const bookingId = bookings[0].id;

    await cancelBooking(repos, provider, tracker2, bookingId);
    expect(tracker2.captured).toHaveLength(1);
    expect(tracker2.captured[0]).toEqual({
      distinctId: "m1",
      event: "booking_cancelled",
      properties: { session_id: "cs1" },
    });
  });

  it("uses member id as distinctId for all events", async () => {
    const provider = createFakeProvider();
    const tracker1 = createFakeTracker();
    __setTestTracker(tracker1);
    await createBooking(repos, provider, tracker1, { sessionId: "cs1", memberId: "m2" });

    const tracker2 = createFakeTracker();
    __setTestTracker(tracker2);
    const bookings = await repos.bookings.listBySession("cs1");
    const bookingId = bookings[0].id;
    await cancelBooking(repos, provider, tracker2, bookingId);

    expect(tracker1.captured[0].distinctId).toBe("m2");
    expect(tracker2.captured[0].distinctId).toBe("m2");
  });

  it("includes session_id in all event properties", async () => {
    const provider = createFakeProvider();
    const tracker1 = createFakeTracker();
    __setTestTracker(tracker1);
    await createBooking(repos, provider, tracker1, { sessionId: "cs1", memberId: "m1" });

    const tracker2 = createFakeTracker();
    __setTestTracker(tracker2);
    const bookings = await repos.bookings.listBySession("cs1");
    const bookingId = bookings[0].id;
    await cancelBooking(repos, provider, tracker2, bookingId);

    expect(tracker1.captured[0].properties?.session_id).toBe("cs1");
    expect(tracker2.captured[0].properties?.session_id).toBe("cs1");
  });

  it("does not include email, name, or phone in event properties", async () => {
    const provider = createFakeProvider();
    await createBooking(repos, provider, tracker, {
      sessionId: "cs1",
      memberId: "m1",
    });

    expect(tracker.captured[0].properties).toBeDefined();
    const props = tracker.captured[0].properties || {};
    expect(Object.keys(props)).not.toContain("email");
    expect(Object.keys(props)).not.toContain("name");
    expect(Object.keys(props)).not.toContain("phone");
    expect(JSON.stringify(props)).not.toContain("@e.co");
    expect(JSON.stringify(props)).not.toContain("m1"); // The member name equals the id in test fixtures
  });

  it("resolveTracker returns the injected test tracker when set", () => {
    const testTracker = createFakeTracker();
    __setTestTracker(testTracker);
    expect(resolveTracker()).toBe(testTracker);
  });
});
