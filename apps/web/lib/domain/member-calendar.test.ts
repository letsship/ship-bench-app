import { describe, it, expect } from "vitest";
import type { Booking } from "@/lib/db/types";
import { newCalendarToken, seatTakenSessionIds } from "./member-calendar";

describe("member-calendar", () => {
  describe("newCalendarToken", () => {
    it("produces a non-empty string", () => {
      const token = newCalendarToken();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    });

    it("produces a URL-safe hex string", () => {
      const token = newCalendarToken();
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });

    it("produces unique tokens across calls", () => {
      const tokens = Array.from({ length: 10 }, () => newCalendarToken());
      const unique = new Set(tokens);
      expect(unique.size).toBe(10);
    });

    it("produces tokens of consistent length", () => {
      const token1 = newCalendarToken();
      const token2 = newCalendarToken();
      expect(token1.length).toBe(token2.length);
    });
  });

  describe("seatTakenSessionIds", () => {
    it("includes bookings with booked status", () => {
      const bookings: Booking[] = [
        {
          id: "b1",
          sessionId: "s1",
          memberId: "m1",
          status: "booked",
          bookedAt: "2026-01-01T00:00:00Z",
          cancelledAt: null,
        },
      ];
      const ids = seatTakenSessionIds(bookings);
      expect(ids).toContain("s1");
    });

    it("includes bookings with attended status", () => {
      const bookings: Booking[] = [
        {
          id: "b1",
          sessionId: "s1",
          memberId: "m1",
          status: "attended",
          bookedAt: "2026-01-01T00:00:00Z",
          cancelledAt: null,
        },
      ];
      const ids = seatTakenSessionIds(bookings);
      expect(ids).toContain("s1");
    });

    it("includes bookings with no_show status", () => {
      const bookings: Booking[] = [
        {
          id: "b1",
          sessionId: "s1",
          memberId: "m1",
          status: "no_show",
          bookedAt: "2026-01-01T00:00:00Z",
          cancelledAt: null,
        },
      ];
      const ids = seatTakenSessionIds(bookings);
      expect(ids).toContain("s1");
    });

    it("excludes bookings with waitlisted status", () => {
      const bookings: Booking[] = [
        {
          id: "b1",
          sessionId: "s1",
          memberId: "m1",
          status: "waitlisted",
          bookedAt: "2026-01-01T00:00:00Z",
          cancelledAt: null,
        },
      ];
      const ids = seatTakenSessionIds(bookings);
      expect(ids).not.toContain("s1");
    });

    it("excludes bookings with cancelled status", () => {
      const bookings: Booking[] = [
        {
          id: "b1",
          sessionId: "s1",
          memberId: "m1",
          status: "cancelled",
          bookedAt: "2026-01-01T00:00:00Z",
          cancelledAt: "2026-01-02T00:00:00Z",
        },
      ];
      const ids = seatTakenSessionIds(bookings);
      expect(ids).not.toContain("s1");
    });
  });
});
