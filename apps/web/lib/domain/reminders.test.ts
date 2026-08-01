import { describe, expect, it } from "vitest";
import { isConfirmedSeat, reminderWindow } from "./reminders";

const NOW = "2026-08-01T12:00:00.000Z";

describe("reminderWindow", () => {
  it("starts at now and ends 24 hours later", () => {
    expect(reminderWindow(NOW)).toEqual({
      from: NOW,
      to: "2026-08-02T12:00:00.000Z",
    });
  });

  it("supports a custom duration", () => {
    expect(reminderWindow(NOW, 1).to).toBe("2026-08-01T13:00:00.000Z");
  });
});

describe("isConfirmedSeat", () => {
  it("accepts booked seats only", () => {
    expect(isConfirmedSeat("booked")).toBe(true);
    expect(isConfirmedSeat("waitlisted")).toBe(false);
    expect(isConfirmedSeat("cancelled")).toBe(false);
  });
});
