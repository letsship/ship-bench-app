import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeTracker } from "@/lib/analytics/fake-tracker";
import { __setTestTracker } from "@/lib/analytics/provider";
import { __setTestRepositories } from "@/lib/db/repos";
import { cancelBooking, createBooking } from "./bookings";
import { createFakeProvider } from "@/lib/notifications/fake-provider";

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

describe("analytics through service flows", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    __setTestTracker(createFakeTracker());
  });

  afterEach(() => {
    __setTestRepositories(null);
    __setTestTracker(null);
  });

  describe("createBooking analytics", () => {
    it("captures booking_created exactly once when booking is confirmed", async () => {
      const repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [member("m1")],
        }),
      );
      const tracker = createFakeTracker();
      await createBooking(repos, createFakeProvider(), tracker, {
        sessionId: "cs1",
        memberId: "m1",
      });

      const bookingEvents = tracker.captured.filter((e) => e.event === "booking_created");
      expect(bookingEvents).toHaveLength(1);
      expect(bookingEvents[0].distinctId).toBe("m1");
      expect(bookingEvents[0].properties.session_id).toBe("cs1");
    });

    it("captures waitlist_joined exactly once when booking is waitlisted", async () => {
      const repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1", { capacity: 1 })],
          members: [member("m1"), member("m2")],
          bookings: [booking("b1", "m1")],
        }),
      );
      const tracker = createFakeTracker();
      await createBooking(repos, createFakeProvider(), tracker, {
        sessionId: "cs1",
        memberId: "m2",
      });

      const waitlistEvents = tracker.captured.filter((e) => e.event === "waitlist_joined");
      expect(waitlistEvents).toHaveLength(1);
      expect(waitlistEvents[0].distinctId).toBe("m2");
      expect(waitlistEvents[0].properties.session_id).toBe("cs1");
    });

    it("never captures both booking_created and waitlist_joined for the same booking", async () => {
      const repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1", { capacity: 1 })],
          members: [member("m1"), member("m2")],
          bookings: [booking("b1", "m1")],
        }),
      );
      const tracker = createFakeTracker();
      await createBooking(repos, createFakeProvider(), tracker, {
        sessionId: "cs1",
        memberId: "m2",
      });

      const bookingEvents = tracker.captured.filter((e) => e.event === "booking_created");
      expect(bookingEvents).toHaveLength(0);
    });

    it("does not include email, name, or phone in event properties", async () => {
      const repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [member("m1")],
        }),
      );
      const tracker = createFakeTracker();
      await createBooking(repos, createFakeProvider(), tracker, {
        sessionId: "cs1",
        memberId: "m1",
      });

      const events = tracker.captured;
      events.forEach((event) => {
        const properties = JSON.stringify(event.properties).toLowerCase();
        expect(properties).not.toContain("email");
        expect(properties).not.toContain("@");
        expect(properties).not.toContain("name");
        expect(properties).not.toContain("phone");
      });
    });
  });

  describe("cancelBooking analytics", () => {
    it("captures booking_cancelled exactly once when booking is cancelled", async () => {
      const repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [member("m1")],
          bookings: [booking("b1", "m1")],
        }),
      );
      const tracker = createFakeTracker();
      await cancelBooking(repos, createFakeProvider(), tracker, "b1");

      const cancelledEvents = tracker.captured.filter((e) => e.event === "booking_cancelled");
      expect(cancelledEvents).toHaveLength(1);
      expect(cancelledEvents[0].distinctId).toBe("m1");
      expect(cancelledEvents[0].properties.session_id).toBe("cs1");
    });

    it("does not include email, name, or phone in cancellation event properties", async () => {
      const repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [member("m1")],
          bookings: [booking("b1", "m1")],
        }),
      );
      const tracker = createFakeTracker();
      await cancelBooking(repos, createFakeProvider(), tracker, "b1");

      const events = tracker.captured.filter((e) => e.event === "booking_cancelled");
      events.forEach((event) => {
        const properties = JSON.stringify(event.properties).toLowerCase();
        expect(properties).not.toContain("email");
        expect(properties).not.toContain("@");
        expect(properties).not.toContain("name");
        expect(properties).not.toContain("phone");
      });
    });
  });
});
