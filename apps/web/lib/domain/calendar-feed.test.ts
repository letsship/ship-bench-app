import { describe, expect, it } from "vitest";
import { selectUpcomingBookedSessions, toCalendarEvents } from "./calendar-feed";
import type { Booking, ClassSession } from "@/lib/db/types";

describe("calendar-feed", () => {
  const now = new Date("2026-07-27T12:00:00.000Z");
  const studioName = "Test Studio";

  describe("selectUpcomingBookedSessions", () => {
    it("includes upcoming booked sessions", () => {
      const session: ClassSession = {
        id: "s1",
        studioId: "studio1",
        classTypeId: "ct1",
        instructor: "Instructor",
        startsAt: new Date(now.getTime() + 2 * 3600000).toISOString(),
        endsAt: new Date(now.getTime() + 3 * 3600000).toISOString(),
        capacity: 10,
        priceCents: 1800,
        status: "scheduled",
        createdAt: now.toISOString(),
      };
      const booking: Booking = {
        id: "b1",
        sessionId: "s1",
        memberId: "m1",
        status: "booked",
        bookedAt: now.toISOString(),
        cancelledAt: null,
      };
      const sessions = new Map([["s1", session]]);

      const result = selectUpcomingBookedSessions([booking], sessions, now);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("s1");
    });

    it("excludes past sessions", () => {
      const session: ClassSession = {
        id: "s1",
        studioId: "studio1",
        classTypeId: "ct1",
        instructor: "Instructor",
        startsAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
        endsAt: new Date(now.getTime() - 1 * 3600000).toISOString(),
        capacity: 10,
        priceCents: 1800,
        status: "scheduled",
        createdAt: now.toISOString(),
      };
      const booking: Booking = {
        id: "b1",
        sessionId: "s1",
        memberId: "m1",
        status: "booked",
        bookedAt: now.toISOString(),
        cancelledAt: null,
      };
      const sessions = new Map([["s1", session]]);

      const result = selectUpcomingBookedSessions([booking], sessions, now);
      expect(result).toHaveLength(0);
    });

    it("excludes waitlisted bookings", () => {
      const session: ClassSession = {
        id: "s1",
        studioId: "studio1",
        classTypeId: "ct1",
        instructor: "Instructor",
        startsAt: new Date(now.getTime() + 2 * 3600000).toISOString(),
        endsAt: new Date(now.getTime() + 3 * 3600000).toISOString(),
        capacity: 10,
        priceCents: 1800,
        status: "scheduled",
        createdAt: now.toISOString(),
      };
      const booking: Booking = {
        id: "b1",
        sessionId: "s1",
        memberId: "m1",
        status: "waitlisted",
        bookedAt: now.toISOString(),
        cancelledAt: null,
      };
      const sessions = new Map([["s1", session]]);

      const result = selectUpcomingBookedSessions([booking], sessions, now);
      expect(result).toHaveLength(0);
    });

    it("excludes cancelled bookings", () => {
      const session: ClassSession = {
        id: "s1",
        studioId: "studio1",
        classTypeId: "ct1",
        instructor: "Instructor",
        startsAt: new Date(now.getTime() + 2 * 3600000).toISOString(),
        endsAt: new Date(now.getTime() + 3 * 3600000).toISOString(),
        capacity: 10,
        priceCents: 1800,
        status: "scheduled",
        createdAt: now.toISOString(),
      };
      const booking: Booking = {
        id: "b1",
        sessionId: "s1",
        memberId: "m1",
        status: "cancelled",
        bookedAt: now.toISOString(),
        cancelledAt: now.toISOString(),
      };
      const sessions = new Map([["s1", session]]);

      const result = selectUpcomingBookedSessions([booking], sessions, now);
      expect(result).toHaveLength(0);
    });

    it("sorts sessions by start time", () => {
      const session1: ClassSession = {
        id: "s1",
        studioId: "studio1",
        classTypeId: "ct1",
        instructor: "Instructor",
        startsAt: new Date(now.getTime() + 4 * 3600000).toISOString(),
        endsAt: new Date(now.getTime() + 5 * 3600000).toISOString(),
        capacity: 10,
        priceCents: 1800,
        status: "scheduled",
        createdAt: now.toISOString(),
      };
      const session2: ClassSession = {
        id: "s2",
        studioId: "studio1",
        classTypeId: "ct1",
        instructor: "Instructor",
        startsAt: new Date(now.getTime() + 2 * 3600000).toISOString(),
        endsAt: new Date(now.getTime() + 3 * 3600000).toISOString(),
        capacity: 10,
        priceCents: 1800,
        status: "scheduled",
        createdAt: now.toISOString(),
      };
      const booking1: Booking = {
        id: "b1",
        sessionId: "s1",
        memberId: "m1",
        status: "booked",
        bookedAt: now.toISOString(),
        cancelledAt: null,
      };
      const booking2: Booking = {
        id: "b2",
        sessionId: "s2",
        memberId: "m1",
        status: "booked",
        bookedAt: now.toISOString(),
        cancelledAt: null,
      };
      const sessions = new Map([
        ["s1", session1],
        ["s2", session2],
      ]);

      const result = selectUpcomingBookedSessions([booking1, booking2], sessions, now);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("s2");
      expect(result[1].id).toBe("s1");
    });
  });

  describe("toCalendarEvents", () => {
    it("produces well-formed calendar events", () => {
      const session: ClassSession = {
        id: "s1",
        studioId: "studio1",
        classTypeId: "ct1",
        instructor: "Noor",
        startsAt: "2026-07-29T09:00:00.000Z",
        endsAt: "2026-07-29T10:00:00.000Z",
        capacity: 10,
        priceCents: 1800,
        status: "scheduled",
        createdAt: now.toISOString(),
      };
      const classTypeNames = new Map([["ct1", "Vinyasa Flow"]]);

      const events = toCalendarEvents([session], classTypeNames, studioName);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        uid: "s1@studiobook",
        title: "Vinyasa Flow",
        startsAt: "2026-07-29T09:00:00.000Z",
        endsAt: "2026-07-29T10:00:00.000Z",
        description: "Instructor: Noor",
        location: studioName,
      });
    });
  });
});
