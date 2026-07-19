import { describe, it, expect } from "vitest";
import { filterUpcomingBookedSessions } from "./member-calendar";
import type { ClassSession, Booking } from "../db/types";

describe("filterUpcomingBookedSessions", () => {
  const memberId = "member-1";

  function session(id: string, startsAt: string): ClassSession {
    return {
      id,
      studioId: "studio-1",
      classTypeId: "class-1",
      instructor: "Instructor",
      startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + 3600000).toISOString(),
      capacity: 10,
      priceCents: 1800,
      status: "scheduled",
      createdAt: new Date().toISOString(),
    };
  }

  function booking(sessionId: string, status: string): Booking {
    return {
      id: `booking-${sessionId}`,
      sessionId,
      memberId,
      status,
      bookedAt: new Date().toISOString(),
      cancelledAt: null,
    };
  }

  it("includes future sessions where member has a seat-taking booking", () => {
    const now = new Date("2026-07-19T12:00:00Z");
    const futureSession = session("s1", "2026-07-20T09:00:00Z");
    const bookings = [booking("s1", "booked")];

    const result = filterUpcomingBookedSessions([futureSession], bookings, now);

    expect(result).toEqual([futureSession]);
  });

  it("excludes past sessions", () => {
    const now = new Date("2026-07-19T12:00:00Z");
    const pastSession = session("s1", "2026-07-18T09:00:00Z");
    const bookings = [booking("s1", "booked")];

    const result = filterUpcomingBookedSessions([pastSession], bookings, now);

    expect(result).toEqual([]);
  });

  it("excludes future sessions where member has no seat-taking booking", () => {
    const now = new Date("2026-07-19T12:00:00Z");
    const futureSession = session("s1", "2026-07-20T09:00:00Z");
    const bookings = [booking("s1", "waitlisted")];

    const result = filterUpcomingBookedSessions([futureSession], bookings, now);

    expect(result).toEqual([]);
  });

  it("excludes sessions with no booking for this member", () => {
    const now = new Date("2026-07-19T12:00:00Z");
    const futureSession = session("s1", "2026-07-20T09:00:00Z");
    // memberBookings comes from repos.bookings.listByMember(memberId), so it only
    // contains bookings for this member. If there's no booking for this session,
    // the bookings list will be empty.
    const bookings: Booking[] = [];

    const result = filterUpcomingBookedSessions([futureSession], bookings, now);

    expect(result).toEqual([]);
  });

  it("includes attended and no_show as seat-taking statuses", () => {
    const now = new Date("2026-07-19T12:00:00Z");
    const futureSession1 = session("s1", "2026-07-20T09:00:00Z");
    const futureSession2 = session("s2", "2026-07-21T09:00:00Z");
    const bookings = [booking("s1", "attended"), booking("s2", "no_show")];

    const result = filterUpcomingBookedSessions([futureSession1, futureSession2], bookings, now);

    expect(result).toHaveLength(2);
  });

  it("excludes cancelled and waitlisted bookings", () => {
    const now = new Date("2026-07-19T12:00:00Z");
    const s1 = session("s1", "2026-07-20T09:00:00Z");
    const s2 = session("s2", "2026-07-21T09:00:00Z");
    const bookings = [booking("s1", "cancelled"), booking("s2", "waitlisted")];

    const result = filterUpcomingBookedSessions([s1, s2], bookings, now);

    expect(result).toEqual([]);
  });

  it("handles empty sessions", () => {
    const now = new Date("2026-07-19T12:00:00Z");
    const result = filterUpcomingBookedSessions([], [], now);

    expect(result).toEqual([]);
  });

  it("sorts output by startsAt (preserves session order)", () => {
    const now = new Date("2026-07-19T12:00:00Z");
    const sessions = [
      session("s3", "2026-07-22T09:00:00Z"),
      session("s1", "2026-07-20T09:00:00Z"),
      session("s2", "2026-07-21T09:00:00Z"),
    ];
    const bookings = [booking("s1", "booked"), booking("s2", "booked"), booking("s3", "booked")];

    const result = filterUpcomingBookedSessions(sessions, bookings, now);

    expect(result.map((s) => s.id)).toEqual(["s3", "s1", "s2"]);
  });
});
