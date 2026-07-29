import { describe, expect, it } from "vitest";
import { isWithinReminderWindow, selectSessionsDueForReminder } from "./reminders";

const NOW = "2026-03-15T12:00:00.000Z";

describe("isWithinReminderWindow", () => {
  it("returns true for a session starting in 2 hours", () => {
    expect(isWithinReminderWindow("2026-03-15T14:00:00.000Z", NOW)).toBe(true);
  });

  it("returns true for a session starting exactly at now+24h", () => {
    expect(isWithinReminderWindow("2026-03-16T12:00:00.000Z", NOW)).toBe(true);
  });

  it("returns false for a session starting just past now+24h", () => {
    expect(isWithinReminderWindow("2026-03-16T12:00:01.000Z", NOW)).toBe(false);
  });

  it("returns false for a session in the past", () => {
    expect(isWithinReminderWindow("2026-03-15T11:00:00.000Z", NOW)).toBe(false);
  });

  it("returns false for a session starting exactly at now", () => {
    expect(isWithinReminderWindow("2026-03-15T12:00:00.000Z", NOW)).toBe(false);
  });

  it("respects a custom windowHours", () => {
    expect(isWithinReminderWindow("2026-03-15T13:00:00.000Z", NOW, 1)).toBe(true);
    expect(isWithinReminderWindow("2026-03-15T14:00:00.000Z", NOW, 1)).toBe(false);
  });
});

describe("selectSessionsDueForReminder", () => {
  it("keeps only scheduled sessions within the window", () => {
    const sessions = [
      { id: "s1", startsAt: "2026-03-15T14:00:00.000Z", status: "scheduled" },
      { id: "s2", startsAt: "2026-03-16T12:00:00.000Z", status: "scheduled" },
      { id: "s3", startsAt: "2026-03-16T13:00:00.000Z", status: "scheduled" },
      { id: "s4", startsAt: "2026-03-15T13:00:00.000Z", status: "cancelled" },
      { id: "s5", startsAt: "2026-03-15T10:00:00.000Z", status: "scheduled" },
    ];
    const due = selectSessionsDueForReminder(sessions, NOW);
    expect(due).toHaveLength(2);
    expect(due.map((s) => s.id)).toEqual(["s1", "s2"]);
  });
});