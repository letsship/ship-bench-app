import { describe, expect, it } from "vitest";
import { isWithinReminderWindow, REMINDER_WINDOW_HOURS } from "./reminders";

const NOW = "2026-03-15T12:00:00.000Z";
const plusHours = (hours: number): string =>
  new Date(new Date(NOW).getTime() + hours * 3_600_000).toISOString();

describe("isWithinReminderWindow", () => {
  it("includes a session starting exactly now", () => {
    expect(isWithinReminderWindow(NOW, NOW)).toBe(true);
  });

  it("includes a session just inside the 24-hour edge", () => {
    expect(isWithinReminderWindow(plusHours(23.99), NOW)).toBe(true);
  });

  it("includes a session exactly 24 hours out", () => {
    expect(isWithinReminderWindow(plusHours(REMINDER_WINDOW_HOURS), NOW)).toBe(true);
  });

  it("excludes a session beyond the 24-hour edge", () => {
    expect(isWithinReminderWindow(plusHours(24.01), NOW)).toBe(false);
    expect(isWithinReminderWindow(plusHours(48), NOW)).toBe(false);
  });

  it("excludes a session that has already started", () => {
    expect(isWithinReminderWindow(plusHours(-0.01), NOW)).toBe(false);
    expect(isWithinReminderWindow(plusHours(-24), NOW)).toBe(false);
  });

  it("honours a custom window", () => {
    expect(isWithinReminderWindow(plusHours(5), NOW, 2)).toBe(false);
    expect(isWithinReminderWindow(plusHours(1), NOW, 2)).toBe(true);
  });
});
