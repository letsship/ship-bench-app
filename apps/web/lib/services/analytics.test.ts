import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createFakeTracker } from "@/lib/analytics/fake-tracker";
import { __setTestTracker } from "@/lib/analytics/tracker";
import { cancelBooking, createBooking } from "./bookings";

const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

function baseSeed(
  over: {
    members?: Member[];
    classTypes?: ClassType[];
    sessions?: ClassSession[];
    bookings?: Booking[];
  } = {},
) {
  const ISO = NOW.toISOString();
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
    members: over.members ?? [],
    classTypes: over.classTypes ?? [],
    sessions: over.sessions ?? [],
    bookings: over.bookings ?? [],
    invoices: [],
    lineItems: [],
    outbox: [],
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

describe("analytics: booking events", () => {
  beforeEach(() => {
    __setTestTracker(null);
  });

  afterEach(() => {
    __setTestTracker(null);
  });

  it("booking_created fires exactly once when a booking is confirmed", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    await createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }, tracker);

    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toEqual({
      event: "booking_created",
      distinctId: "m1",
      properties: { session_id: "cs1" },
    });
  });

  it("waitlist_joined fires exactly once when a booking is waitlisted", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 1 })],
        members: [member("m1"), member("m2")],
        bookings: [booking("b1", "m1")],
      }),
    );
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    await createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m2" }, tracker);

    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toEqual({
      event: "waitlist_joined",
      distinctId: "m2",
      properties: { session_id: "cs1" },
    });
  });

  it("waitlist_joined and booking_created are mutually exclusive", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 1 })],
        members: [member("m1"), member("m2")],
        bookings: [booking("b1", "m1")],
      }),
    );
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    // First booking was already in the seed, so we clear and start fresh
    tracker.captured.length = 0;

    // Second booking: waitlisted (because full)
    await createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m2" }, tracker);
    expect(tracker.captured[0].event).toBe("waitlist_joined");

    // No booking_created in the waitlist scenario
    const hasBookingCreated = tracker.captured.some((e) => e.event === "booking_created");
    expect(hasBookingCreated).toBe(false);
  });

  it("booking_cancelled fires exactly once when a booking is cancelled", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        bookings: [booking("b1", "m1")],
      }),
    );
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    await cancelBooking(repos, createFakeProvider(), "b1", tracker);

    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]).toEqual({
      event: "booking_cancelled",
      distinctId: "m1",
      properties: { session_id: "cs1" },
    });
  });

  it("events use member.id as distinctId", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("custom-member-id")],
      }),
    );
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    await createBooking(
      repos,
      createFakeProvider(),
      {
        sessionId: "cs1",
        memberId: "custom-member-id",
      },
      tracker,
    );

    expect(tracker.captured[0].distinctId).toBe("custom-member-id");
  });

  it("events carry session_id property with the class session id", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    await createBooking(
      repos,
      createFakeProvider(),
      {
        sessionId: "cs1",
        memberId: "m1",
      },
      tracker,
    );

    expect(tracker.captured[0].properties?.session_id).toBe("cs1");
  });

  it("captured events contain no PII (email, name, phone)", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1", { email: "secret@example.com", name: "SecretName" })],
      }),
    );
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    await createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }, tracker);
    await cancelBooking(
      repos,
      createFakeProvider(),
      (await repos.bookings.listBySession("cs1"))[0]!.id,
      tracker,
    );

    for (const event of tracker.captured) {
      const props = JSON.stringify(event.properties ?? {});
      expect(props).not.toMatch(/secret@example.com/i);
      expect(props).not.toMatch(/SecretName/i);
      expect(props).not.toContain("email");
      expect(props).not.toContain("name");
      expect(props).not.toContain("phone");
    }
  });

  it("booking_cancelled does not fire on waitlist promotion", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 1 })],
        members: [member("m1"), member("m2"), member("m3")],
        bookings: [
          booking("b1", "m1"),
          booking("b2", "m2", { status: "waitlisted", bookedAt: "2026-03-15T10:00:00.000Z" }),
          booking("b3", "m3", { status: "waitlisted", bookedAt: "2026-03-15T11:00:00.000Z" }),
        ],
      }),
    );
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    // Cancel the booked member's booking (b1)
    await cancelBooking(repos, createFakeProvider(), "b1", tracker);

    // Should have: 1 booking_cancelled (for b1) + possibly other events but NOT booking_created for promotion
    const events = tracker.captured.map((e) => e.event);
    expect(events.filter((e) => e === "booking_cancelled")).toHaveLength(1);
    expect(events).not.toContain("booking_created");
  });

  it("events fire exactly once per flow", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );
    const tracker = createFakeTracker();
    __setTestTracker(tracker);

    // Create booking
    await createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }, tracker);
    expect(tracker.captured).toHaveLength(1);

    // Get the booking id
    const bookings = await repos.bookings.listBySession("cs1");
    const bookingId = bookings[0]!.id;

    // Cancel booking
    tracker.captured.length = 0;
    await cancelBooking(repos, createFakeProvider(), bookingId, tracker);
    expect(tracker.captured).toHaveLength(1);
  });
});
