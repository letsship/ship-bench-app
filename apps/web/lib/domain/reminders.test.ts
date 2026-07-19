import { describe, expect, it } from "vitest";
import { selectBookingsToRemind } from "./reminders";
import { newId } from "@/lib/db/ids";
import type { ClassSession, Booking, Member } from "@/lib/db/types";

const NOW = new Date("2026-03-15T12:00:00.000Z").toISOString();
const IN_24H = new Date(new Date(NOW).getTime() + 12 * 60 * 60 * 1000).toISOString();
const IN_48H = new Date(new Date(NOW).getTime() + 36 * 60 * 60 * 1000).toISOString();

function makeSession(overrides: Partial<ClassSession> = {}): ClassSession {
  const id = newId();
  return {
    id,
    studioId: "studio1",
    classTypeId: newId(),
    instructor: "Test Instructor",
    startsAt: IN_24H,
    endsAt: new Date(new Date(IN_24H).getTime() + 60 * 60 * 1000).toISOString(),
    capacity: 10,
    priceCents: 1800,
    status: "scheduled",
    createdAt: NOW,
    ...overrides,
  };
}

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: newId(),
    sessionId: "session1",
    memberId: "member1",
    status: "booked",
    bookedAt: NOW,
    cancelledAt: null,
    ...overrides,
  };
}

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: "member1",
    studioId: "studio1",
    name: "Test Member",
    email: "test@example.com",
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: NOW,
    ...overrides,
  };
}

describe("selectBookingsToRemind", () => {
  it("includes booked bookings for sessions within the 24h window", () => {
    const session = makeSession();
    const booking = makeBooking({ sessionId: session.id });
    const member = makeMember();
    const result = selectBookingsToRemind({
      sessions: [session],
      bookings: [booking],
      members: new Map([[member.id, member]]),
      alreadyRemindedBookingIds: new Set(),
      now: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0].booking.id).toBe(booking.id);
  });

  it("excludes bookings for sessions outside the 24h window", () => {
    const session = makeSession({ startsAt: IN_48H });
    const booking = makeBooking({ sessionId: session.id });
    const member = makeMember();
    const result = selectBookingsToRemind({
      sessions: [session],
      bookings: [booking],
      members: new Map([[member.id, member]]),
      alreadyRemindedBookingIds: new Set(),
      now: NOW,
    });
    expect(result).toHaveLength(0);
  });

  it("excludes bookings for cancelled sessions", () => {
    const session = makeSession({ status: "cancelled" });
    const booking = makeBooking({ sessionId: session.id });
    const member = makeMember();
    const result = selectBookingsToRemind({
      sessions: [session],
      bookings: [booking],
      members: new Map([[member.id, member]]),
      alreadyRemindedBookingIds: new Set(),
      now: NOW,
    });
    expect(result).toHaveLength(0);
  });

  it("excludes waitlisted bookings", () => {
    const session = makeSession();
    const booking = makeBooking({ sessionId: session.id, status: "waitlisted" });
    const member = makeMember();
    const result = selectBookingsToRemind({
      sessions: [session],
      bookings: [booking],
      members: new Map([[member.id, member]]),
      alreadyRemindedBookingIds: new Set(),
      now: NOW,
    });
    expect(result).toHaveLength(0);
  });

  it("excludes bookings for members who have opted out", () => {
    const session = makeSession();
    const booking = makeBooking({ sessionId: session.id });
    const member = makeMember({ notificationsOptedOut: true });
    const result = selectBookingsToRemind({
      sessions: [session],
      bookings: [booking],
      members: new Map([[member.id, member]]),
      alreadyRemindedBookingIds: new Set(),
      now: NOW,
    });
    expect(result).toHaveLength(0);
  });

  it("excludes bookings that already have a reminder queued", () => {
    const session = makeSession();
    const booking = makeBooking({ sessionId: session.id });
    const member = makeMember();
    const result = selectBookingsToRemind({
      sessions: [session],
      bookings: [booking],
      members: new Map([[member.id, member]]),
      alreadyRemindedBookingIds: new Set([booking.id]),
      now: NOW,
    });
    expect(result).toHaveLength(0);
  });

  it("excludes bookings for unknown members", () => {
    const session = makeSession();
    const booking = makeBooking({ sessionId: session.id, memberId: "unknown-member" });
    const member = makeMember();
    const result = selectBookingsToRemind({
      sessions: [session],
      bookings: [booking],
      members: new Map([[member.id, member]]),
      alreadyRemindedBookingIds: new Set(),
      now: NOW,
    });
    expect(result).toHaveLength(0);
  });

  it("includes multiple bookings for different sessions in the window", () => {
    const session1 = makeSession();
    const session2 = makeSession({ startsAt: IN_24H });
    const booking1 = makeBooking({ sessionId: session1.id });
    const booking2 = makeBooking({ sessionId: session2.id, memberId: "member2" });
    const member1 = makeMember();
    const member2 = makeMember({ id: "member2" });
    const result = selectBookingsToRemind({
      sessions: [session1, session2],
      bookings: [booking1, booking2],
      members: new Map([
        [member1.id, member1],
        [member2.id, member2],
      ]),
      alreadyRemindedBookingIds: new Set(),
      now: NOW,
    });
    expect(result).toHaveLength(2);
  });
});
