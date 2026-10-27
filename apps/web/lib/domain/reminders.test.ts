import { describe, expect, it } from "vitest";
import { reminderDedupKey, reminderWindow } from "./reminders";

describe("reminderWindow", () => {
  it("returns the half-open [now, now+24h) window as ISO strings", () => {
    const now = new Date("2026-03-15T12:00:00.000Z");
    const window = reminderWindow(now);
    expect(window.from).toBe("2026-03-15T12:00:00.000Z");
    expect(window.to).toBe("2026-03-16T12:00:00.000Z");
  });
});

describe("reminderDedupKey", () => {
  it("is namespaced per booking", () => {
    expect(reminderDedupKey("booking-123")).toBe("booking_reminder:booking-123");
  });
});
