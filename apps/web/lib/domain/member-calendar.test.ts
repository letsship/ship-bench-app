import { describe, it, expect } from "vitest";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import { getMemberUpcomingBookedEvents } from "./member-calendar";

describe("getMemberUpcomingBookedEvents", () => {
  const now = new Date("2026-07-19T12:00:00Z").toISOString();

  const studioId = "studio-1";
  const member1: Member = {
    id: "member-1",
    studioId,
    name: "Alice",
    email: "alice@example.com",
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    calendarToken: "token-1",
    createdAt: "2026-01-01T00:00:00Z",
  };

  const classType1: ClassType = {
    id: "class-1",
    studioId,
    name: "Yoga",
    description: "Yoga class",
    color: "#5b8c5a",
    defaultCapacity: 16,
    defaultPriceCents: 1800,
    createdAt: "2026-01-01T00:00:00Z",
  };

  const sessionFuture: ClassSession = {
    id: "session-1",
    studioId,
    classTypeId: "class-1",
    instructor: "Noor",
    startsAt: new Date(new Date(now).getTime() + 86400000).toISOString(), // 1 day from now
    endsAt: new Date(new Date(now).getTime() + 86400000 + 3600000).toISOString(),
    capacity: 16,
    priceCents: 1800,
    status: "scheduled",
    createdAt: "2026-01-01T00:00:00Z",
  };

  const sessionPast: ClassSession = {
    id: "session-2",
    studioId,
    classTypeId: "class-1",
    instructor: "Sanne",
    startsAt: new Date(new Date(now).getTime() - 86400000).toISOString(), // 1 day ago
    endsAt: new Date(new Date(now).getTime() - 86400000 + 3600000).toISOString(),
    capacity: 16,
    priceCents: 1800,
    status: "scheduled",
    createdAt: "2026-01-01T00:00:00Z",
  };

  it("includes only the target member's future booked sessions", () => {
    const bookings: Booking[] = [
      {
        id: "booking-1",
        sessionId: "session-1",
        memberId: "member-1",
        status: "booked",
        bookedAt: now,
        cancelledAt: null,
      },
      {
        id: "booking-2",
        sessionId: "session-1",
        memberId: "member-2",
        status: "booked",
        bookedAt: now,
        cancelledAt: null,
      },
    ];

    const events = getMemberUpcomingBookedEvents(
      member1,
      bookings,
      [sessionFuture],
      [classType1],
      now,
    );

    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe("session-1@studiobook");
    expect(events[0].title).toBe("Yoga");
  });

  it("excludes past sessions", () => {
    const bookings: Booking[] = [
      {
        id: "booking-1",
        sessionId: "session-2",
        memberId: "member-1",
        status: "booked",
        bookedAt: now,
        cancelledAt: null,
      },
    ];

    const events = getMemberUpcomingBookedEvents(
      member1,
      bookings,
      [sessionPast],
      [classType1],
      now,
    );

    expect(events).toHaveLength(0);
  });

  it("excludes non-booked bookings (waitlisted, cancelled)", () => {
    const bookings: Booking[] = [
      {
        id: "booking-1",
        sessionId: "session-1",
        memberId: "member-1",
        status: "waitlisted",
        bookedAt: now,
        cancelledAt: null,
      },
      {
        id: "booking-2",
        sessionId: "session-1",
        memberId: "member-1",
        status: "cancelled",
        bookedAt: now,
        cancelledAt: now,
      },
    ];

    const events = getMemberUpcomingBookedEvents(
      member1,
      bookings,
      [sessionFuture],
      [classType1],
      now,
    );

    expect(events).toHaveLength(0);
  });

  it("includes correct event structure", () => {
    const bookings: Booking[] = [
      {
        id: "booking-1",
        sessionId: "session-1",
        memberId: "member-1",
        status: "booked",
        bookedAt: now,
        cancelledAt: null,
      },
    ];

    const events = getMemberUpcomingBookedEvents(
      member1,
      bookings,
      [sessionFuture],
      [classType1],
      now,
    );

    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.uid).toBe("session-1@studiobook");
    expect(event.title).toBe("Yoga");
    expect(event.startsAt).toBe(sessionFuture.startsAt);
    expect(event.endsAt).toBe(sessionFuture.endsAt);
    expect(event.description).toContain("Noor");
  });

  it("handles missing sessions gracefully", () => {
    const bookings: Booking[] = [
      {
        id: "booking-1",
        sessionId: "non-existent-session",
        memberId: "member-1",
        status: "booked",
        bookedAt: now,
        cancelledAt: null,
      },
    ];

    const events = getMemberUpcomingBookedEvents(
      member1,
      bookings,
      [sessionFuture],
      [classType1],
      now,
    );

    expect(events).toHaveLength(0);
  });

  it("handles missing class types gracefully", () => {
    const bookings: Booking[] = [
      {
        id: "booking-1",
        sessionId: "session-1",
        memberId: "member-1",
        status: "booked",
        bookedAt: now,
        cancelledAt: null,
      },
    ];

    const events = getMemberUpcomingBookedEvents(
      member1,
      bookings,
      [sessionFuture],
      [], // no class types
      now,
    );

    expect(events).toHaveLength(0);
  });
});
