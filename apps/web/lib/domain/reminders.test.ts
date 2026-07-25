import { describe, expect, it } from "vitest";
import { isConfirmedSeat, reminderWindow } from "./reminders";

describe("reminders domain", () => {
  describe("reminderWindow", () => {
    it("returns a 24-hour window starting from the given timestamp", () => {
      const now = "2026-07-25T12:00:00.000Z";
      const window = reminderWindow(now);
      expect(window.from).toBe(now);
      expect(window.to).toBe("2026-07-26T12:00:00.000Z");
    });

    it("makes the upper bound exclusive", () => {
      const now = "2026-01-01T00:00:00.000Z";
      const window = reminderWindow(now);
      const toDate = new Date(window.to);
      const fromDate = new Date(window.from);
      const hours = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60);
      expect(hours).toBe(24);
    });
  });

  describe("isConfirmedSeat", () => {
    it("returns true for 'booked' status", () => {
      expect(isConfirmedSeat("booked")).toBe(true);
    });

    it("returns false for 'waitlisted' status", () => {
      expect(isConfirmedSeat("waitlisted")).toBe(false);
    });

    it("returns false for other statuses", () => {
      expect(isConfirmedSeat("attended")).toBe(false);
      expect(isConfirmedSeat("no_show")).toBe(false);
    });
  });
});
