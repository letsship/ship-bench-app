import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestTracker } from "@/lib/analytics/tracker";
import { createFakeTracker, type RecordedEvent } from "@/lib/analytics/fake-tracker";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { cancelBooking, createBooking } from "./bookings";

// Anchored to the real clock: the booking/cancellation rules compare against
// `new Date()` inside the services, so fixtures must be genuinely future.
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

// A member row carrying realistic PII so the PII-absence assertions are
// meaningful: if any of these leaked into an event property, the test fails.
const memberWithPii = (id: string): Member =>
  member(id, { name: "Amara Okafor", email: "amara@example.com", phone: "+15551234567" });

const PII_KEYS = ["email", "name", "phone", "memberEmail", "memberName", "memberPhone"];

function assertNoPii(events: RecordedEvent[]): void {
  for (const event of events) {
    for (const key of PII_KEYS) {
      expect(event.properties).not.toHaveProperty(key);
    }
    for (const value of Object.values(event.properties)) {
      expect(value).not.toContain("amara@example.com");
      expect(value).not.toContain("Amara Okafor");
      expect(value).not.toContain("+15551234567");
    }
  }
}

describe("booking funnel analytics", () => {
  let tracker: ReturnType<typeof createFakeTracker>;

  beforeEach(() => {
    tracker = createFakeTracker();
    __setTestTracker(tracker);
  });

  afterEach(() => {
    __setTestTracker(null);
  });

  it("captures booking_created (not waitlist_joined) for a confirmed booking", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [memberWithPii("m1")],
      }),
    );
    const result = await createBooking(repos, createFakeProvider(), {
      sessionId: "cs1",
      memberId: "m1",
    });
    expect(result.status).toBe("booked");

    const events = tracker.events;
    expect(events.map((e) => e.event)).toEqual(["booking_created"]);
    expect(events.filter((e) => e.event === "booking_created")).toHaveLength(1);
    expect(events.some((e) => e.event === "waitlist_joined")).toBe(false);

    const [event] = events;
    expect(event.distinctId).toBe("m1");
    expect(event.properties.session_id).toBe("cs1");
    assertNoPii(events);
  });

  it("captures waitlist_joined (not booking_created) for a full session", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1", { capacity: 1 })],
        members: [member("m1"), memberWithPii("m2")],
        bookings: [booking("b1", "m1")],
      }),
    );
    const result = await createBooking(repos, createFakeProvider(), {
      sessionId: "cs1",
      memberId: "m2",
    });
    expect(result.status).toBe("waitlisted");

    const events = tracker.events;
    expect(events.map((e) => e.event)).toEqual(["waitlist_joined"]);
    expect(events.filter((e) => e.event === "waitlist_joined")).toHaveLength(1);
    expect(events.some((e) => e.event === "booking_created")).toBe(false);

    const [event] = events;
    expect(event.distinctId).toBe("m2");
    expect(event.properties.session_id).toBe("cs1");
    assertNoPii(events);
  });

  it("captures booking_cancelled on cancellation", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [memberWithPii("m1")],
        bookings: [booking("b1", "m1")],
      }),
    );
    await cancelBooking(repos, createFakeProvider(), "b1");

    const events = tracker.events;
    expect(events.map((e) => e.event)).toEqual(["booking_cancelled"]);
    expect(events.filter((e) => e.event === "booking_cancelled")).toHaveLength(1);

    const [event] = events;
    expect(event.distinctId).toBe("m1");
    expect(event.properties.session_id).toBe("cs1");
    assertNoPii(events);
  });
});
