import { describe, expect, it } from "vitest";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import { memberCalendarFeed } from "./calendar";

const NOW = new Date("2026-08-01T12:00:00.000Z");
const ISO = NOW.toISOString();

function seed(): SeedData {
  return {
    studio: { id: "s1", name: "Studio", slug: "studio", timezone: "UTC", createdAt: ISO },
    settings: {
      studioId: "s1",
      currency: "USD",
      taxRateBps: 0,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [
      {
        id: "m1",
        studioId: "s1",
        name: "Member One",
        email: "one@example.com",
        phone: null,
        status: "active",
        calendarToken: "token-one",
        notificationsOptedOut: false,
        createdAt: ISO,
      },
      {
        id: "m2",
        studioId: "s1",
        name: "Member Two",
        email: "two@example.com",
        phone: null,
        status: "active",
        calendarToken: "token-two",
        notificationsOptedOut: false,
        createdAt: ISO,
      },
    ],
    classTypes: [
      {
        id: "ct1",
        studioId: "s1",
        name: "Yoga",
        description: null,
        color: "#000000",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        createdAt: ISO,
      },
    ],
    sessions: [
      {
        id: "future-mine",
        studioId: "s1",
        classTypeId: "ct1",
        instructor: "Ada",
        startsAt: "2026-08-02T09:00:00.000Z",
        endsAt: "2026-08-02T10:00:00.000Z",
        capacity: 10,
        priceCents: 1000,
        status: "scheduled",
        createdAt: ISO,
      },
      {
        id: "past-mine",
        studioId: "s1",
        classTypeId: "ct1",
        instructor: "Bea",
        startsAt: "2026-07-31T09:00:00.000Z",
        endsAt: "2026-07-31T10:00:00.000Z",
        capacity: 10,
        priceCents: 1000,
        status: "scheduled",
        createdAt: ISO,
      },
      {
        id: "future-other",
        studioId: "s1",
        classTypeId: "ct1",
        instructor: "Cy",
        startsAt: "2026-08-03T09:00:00.000Z",
        endsAt: "2026-08-03T10:00:00.000Z",
        capacity: 10,
        priceCents: 1000,
        status: "scheduled",
        createdAt: ISO,
      },
      {
        id: "future-waitlisted",
        studioId: "s1",
        classTypeId: "ct1",
        instructor: "Dee",
        startsAt: "2026-08-04T09:00:00.000Z",
        endsAt: "2026-08-04T10:00:00.000Z",
        capacity: 10,
        priceCents: 1000,
        status: "scheduled",
        createdAt: ISO,
      },
    ],
    bookings: [
      {
        id: "b1",
        sessionId: "future-mine",
        memberId: "m1",
        status: "booked",
        bookedAt: ISO,
        cancelledAt: null,
      },
      {
        id: "b2",
        sessionId: "past-mine",
        memberId: "m1",
        status: "booked",
        bookedAt: ISO,
        cancelledAt: null,
      },
      {
        id: "b3",
        sessionId: "future-other",
        memberId: "m2",
        status: "booked",
        bookedAt: ISO,
        cancelledAt: null,
      },
      {
        id: "b4",
        sessionId: "future-waitlisted",
        memberId: "m1",
        status: "waitlisted",
        bookedAt: ISO,
        cancelledAt: null,
      },
    ],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("memberCalendarFeed", () => {
  it("includes only the token holder's upcoming booked sessions", async () => {
    const feed = await memberCalendarFeed(createInMemoryRepositories(seed()), "token-one", {
      now: NOW,
    });

    expect(feed).toContain("UID:future-mine@studiobook");
    expect(feed).not.toContain("past-mine");
    expect(feed).not.toContain("future-other");
    expect(feed).not.toContain("future-waitlisted");
  });

  it("returns null for unknown or blank tokens", async () => {
    const repos = createInMemoryRepositories(seed());
    expect(await memberCalendarFeed(repos, "unknown", { now: NOW })).toBeNull();
    expect(await memberCalendarFeed(repos, "   ", { now: NOW })).toBeNull();
  });
});
