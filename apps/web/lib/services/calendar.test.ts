import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { getMemberCalendarEvents } from "./calendar";

// Hand-built fixture (rather than the randomized demo seed) so exclusion cases
// — other members, past sessions, non-seat-taking bookings — are unambiguous.

const NOW = new Date("2026-03-15T12:00:00.000Z");
const HOUR = 3_600_000;

const studioId = "studio-1";
const classTypeId = "class-type-1";
const memberA = "member-a";
const memberB = "member-b";
const tokenA = "token-a-secret";
const tokenB = "token-b-secret";

const pastSessionId = "session-past";
const upcomingBookedSessionId = "session-upcoming-booked";
const upcomingWaitlistedSessionId = "session-upcoming-waitlisted";
const upcomingOtherMemberSessionId = "session-upcoming-other-member";

function buildFixture(): SeedData {
  return {
    studio: {
      id: studioId,
      name: "Test Studio",
      slug: "test",
      timezone: "UTC",
      createdAt: NOW.toISOString(),
    },
    settings: {
      studioId,
      currency: "EUR",
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
        id: memberA,
        studioId,
        name: "Member A",
        email: "a@example.com",
        phone: null,
        status: "active",
        notificationsOptedOut: false,
        calendarToken: tokenA,
        createdAt: NOW.toISOString(),
      },
      {
        id: memberB,
        studioId,
        name: "Member B",
        email: "b@example.com",
        phone: null,
        status: "active",
        notificationsOptedOut: false,
        calendarToken: tokenB,
        createdAt: NOW.toISOString(),
      },
    ],
    classTypes: [
      {
        id: classTypeId,
        studioId,
        name: "Vinyasa Flow",
        description: null,
        color: "#5b8c5a",
        defaultCapacity: 10,
        defaultPriceCents: 1800,
        createdAt: NOW.toISOString(),
      },
    ],
    sessions: [
      {
        id: pastSessionId,
        studioId,
        classTypeId,
        instructor: "Noor",
        startsAt: new Date(NOW.getTime() - HOUR).toISOString(),
        endsAt: new Date(NOW.getTime() - HOUR / 2).toISOString(),
        capacity: 10,
        priceCents: 1800,
        status: "scheduled",
        createdAt: NOW.toISOString(),
      },
      {
        id: upcomingBookedSessionId,
        studioId,
        classTypeId,
        instructor: "Sanne",
        startsAt: new Date(NOW.getTime() + HOUR).toISOString(),
        endsAt: new Date(NOW.getTime() + 2 * HOUR).toISOString(),
        capacity: 10,
        priceCents: 1800,
        status: "scheduled",
        createdAt: NOW.toISOString(),
      },
      {
        id: upcomingWaitlistedSessionId,
        studioId,
        classTypeId,
        instructor: "Tomás",
        startsAt: new Date(NOW.getTime() + 3 * HOUR).toISOString(),
        endsAt: new Date(NOW.getTime() + 4 * HOUR).toISOString(),
        capacity: 10,
        priceCents: 1800,
        status: "scheduled",
        createdAt: NOW.toISOString(),
      },
      {
        id: upcomingOtherMemberSessionId,
        studioId,
        classTypeId,
        instructor: "Priya",
        startsAt: new Date(NOW.getTime() + 5 * HOUR).toISOString(),
        endsAt: new Date(NOW.getTime() + 6 * HOUR).toISOString(),
        capacity: 10,
        priceCents: 1800,
        status: "scheduled",
        createdAt: NOW.toISOString(),
      },
    ],
    bookings: [
      // Member A: booked into a past session (should be excluded) ...
      {
        id: "booking-past",
        sessionId: pastSessionId,
        memberId: memberA,
        status: "attended",
        bookedAt: NOW.toISOString(),
        cancelledAt: null,
      },
      // ...booked into an upcoming session (should be included) ...
      {
        id: "booking-upcoming",
        sessionId: upcomingBookedSessionId,
        memberId: memberA,
        status: "booked",
        bookedAt: NOW.toISOString(),
        cancelledAt: null,
      },
      // ...and only waitlisted (not seat-taking) for another upcoming session.
      {
        id: "booking-waitlisted",
        sessionId: upcomingWaitlistedSessionId,
        memberId: memberA,
        status: "waitlisted",
        bookedAt: NOW.toISOString(),
        cancelledAt: null,
      },
      // Member B: booked into an upcoming session Member A has no seat in.
      {
        id: "booking-other-member",
        sessionId: upcomingOtherMemberSessionId,
        memberId: memberB,
        status: "booked",
        bookedAt: NOW.toISOString(),
        cancelledAt: null,
      },
    ],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("getMemberCalendarEvents", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildFixture());
  });

  it("returns null for an unknown token", async () => {
    expect(await getMemberCalendarEvents(repos, "nonexistent-token", NOW)).toBeNull();
  });

  it("returns only the token-holder's upcoming booked session", async () => {
    const events = await getMemberCalendarEvents(repos, tokenA, NOW);
    expect(events).toEqual([
      expect.objectContaining({ uid: `${upcomingBookedSessionId}@studiobook` }),
    ]);
  });

  it("excludes the member's past sessions", async () => {
    const events = await getMemberCalendarEvents(repos, tokenA, NOW);
    expect(events?.some((event) => event.uid === `${pastSessionId}@studiobook`)).toBe(false);
  });

  it("excludes non-seat-taking (waitlisted) bookings", async () => {
    const events = await getMemberCalendarEvents(repos, tokenA, NOW);
    expect(events?.some((event) => event.uid === `${upcomingWaitlistedSessionId}@studiobook`)).toBe(
      false,
    );
  });

  it("excludes other members' sessions", async () => {
    const events = await getMemberCalendarEvents(repos, tokenA, NOW);
    expect(
      events?.some((event) => event.uid === `${upcomingOtherMemberSessionId}@studiobook`),
    ).toBe(false);

    const eventsB = await getMemberCalendarEvents(repos, tokenB, NOW);
    expect(eventsB).toEqual([
      expect.objectContaining({ uid: `${upcomingOtherMemberSessionId}@studiobook` }),
    ]);
  });
});
