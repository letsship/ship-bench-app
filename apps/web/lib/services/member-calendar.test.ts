import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { SeedData } from "@/lib/db/repos/fakes";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { buildMemberCalendarFeed } from "./member-calendar";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const HOUR = 3_600_000;

const member = (id: string, token: string): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: NOW.toISOString(),
  calendarToken: token,
});

const classType: ClassType = {
  id: "ct1",
  studioId: "s1",
  name: "Vinyasa Flow",
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1800,
  createdAt: NOW.toISOString(),
};

function session(id: string, offsetHours: number): ClassSession {
  const startsAt = new Date(NOW.getTime() + offsetHours * HOUR).toISOString();
  return {
    id,
    studioId: "s1",
    classTypeId: classType.id,
    instructor: "Noor",
    startsAt,
    endsAt: new Date(NOW.getTime() + (offsetHours + 1) * HOUR).toISOString(),
    capacity: 10,
    priceCents: 1800,
    status: "scheduled",
    createdAt: NOW.toISOString(),
  };
}

function booking(id: string, sessionId: string, memberId: string, status: string): Booking {
  return { id, sessionId, memberId, status, bookedAt: NOW.toISOString(), cancelledAt: null };
}

function buildFixture(): SeedData {
  const members = [member("m1", "tok-1"), member("m2", "tok-2")];
  const sessions = [
    session("sess-future-own", 24), // m1, booked — should appear
    session("sess-future-other-member", 24), // m2, booked — must not leak to m1
    session("sess-past-own", -24), // m1, booked but in the past — excluded
    session("sess-future-waitlisted", 48), // m1, waitlisted — not a confirmed seat
    session("sess-future-cancelled", 48), // m1, cancelled — freed the seat
  ];
  const bookings = [
    booking("b1", "sess-future-own", "m1", "booked"),
    booking("b2", "sess-future-other-member", "m2", "booked"),
    booking("b3", "sess-past-own", "m1", "attended"),
    booking("b4", "sess-future-waitlisted", "m1", "waitlisted"),
    booking("b5", "sess-future-cancelled", "m1", "cancelled"),
  ];
  return {
    studio: {
      id: "s1",
      name: "Riverbank Movement",
      slug: "riverbank",
      timezone: "UTC",
      createdAt: NOW.toISOString(),
    },
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
    members,
    classTypes: [classType],
    sessions,
    bookings,
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("buildMemberCalendarFeed", () => {
  it("includes only the member's own future booked session", async () => {
    const repos = createInMemoryRepositories(buildFixture());
    const ics = await buildMemberCalendarFeed(repos, "tok-1", { now: NOW });
    expect(ics).not.toBeNull();
    expect(ics).toContain("sess-future-own");
    expect(ics).not.toContain("sess-future-other-member");
    expect(ics).not.toContain("sess-past-own");
    expect(ics).not.toContain("sess-future-waitlisted");
    expect(ics).not.toContain("sess-future-cancelled");
  });

  it("isolates a different member's feed to their own session", async () => {
    const repos = createInMemoryRepositories(buildFixture());
    const ics = await buildMemberCalendarFeed(repos, "tok-2", { now: NOW });
    expect(ics).toContain("sess-future-other-member");
    expect(ics).not.toContain("sess-future-own");
  });

  it("returns null for an unknown token", async () => {
    const repos = createInMemoryRepositories(buildFixture());
    expect(await buildMemberCalendarFeed(repos, "does-not-exist", { now: NOW })).toBeNull();
  });

  it("returns null for an empty token", async () => {
    const repos = createInMemoryRepositories(buildFixture());
    expect(await buildMemberCalendarFeed(repos, "", { now: NOW })).toBeNull();
  });
});
