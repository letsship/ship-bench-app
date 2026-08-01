import { describe, expect, it } from "vitest";
import {
  type ReminderBooking,
  type ReminderMember,
  type ReminderSelection,
  type ReminderSession,
  reminderWindow,
  selectReminders,
} from "./reminders";

const NOW = "2026-03-15T12:00:00.000Z";
const IN_WINDOW = "2026-03-15T18:00:00.000Z";
const AFTER_WINDOW = "2026-03-16T18:00:00.000Z";

const session = (id: string, over: Partial<ReminderSession> = {}): ReminderSession => ({
  id,
  startsAt: IN_WINDOW,
  status: "scheduled",
  ...over,
});

const booking = (id: string, over: Partial<ReminderBooking> = {}): ReminderBooking => ({
  id,
  sessionId: "cs1",
  memberId: "m1",
  status: "booked",
  ...over,
});

const member = (id: string, over: Partial<ReminderMember> = {}): ReminderMember => ({
  id,
  notificationsOptedOut: false,
  ...over,
});

function select(over: Partial<ReminderSelection> = {}): ReminderBooking[] {
  const window = reminderWindow(NOW);
  return selectReminders({
    sessions: [session("cs1")],
    bookings: [booking("b1")],
    members: [member("m1")],
    alreadyRemindedBookingIds: new Set<string>(),
    ...window,
    ...over,
  });
}

describe("reminderWindow", () => {
  it("spans the next 24 hours by default", () => {
    expect(reminderWindow(NOW)).toEqual({ from: NOW, to: "2026-03-16T12:00:00.000Z" });
  });

  it("honours a custom hour span", () => {
    expect(reminderWindow(NOW, 2).to).toBe("2026-03-15T14:00:00.000Z");
  });

  it("rejects an invalid timestamp", () => {
    expect(() => reminderWindow("not-a-date")).toThrow(RangeError);
  });
});

describe("selectReminders", () => {
  it("selects a confirmed booking in a scheduled in-window session", () => {
    expect(select().map((entry) => entry.id)).toEqual(["b1"]);
  });

  it("excludes waitlisted and cancelled bookings", () => {
    expect(select({ bookings: [booking("b1", { status: "waitlisted" })] })).toEqual([]);
    expect(select({ bookings: [booking("b1", { status: "cancelled" })] })).toEqual([]);
  });

  it("excludes sessions outside the window", () => {
    expect(select({ sessions: [session("cs1", { startsAt: AFTER_WINDOW })] })).toEqual([]);
    expect(
      select({ sessions: [session("cs1", { startsAt: "2026-03-15T11:00:00.000Z" })] }),
    ).toEqual([]);
  });

  it("treats the window as [from, to)", () => {
    expect(select({ sessions: [session("cs1", { startsAt: NOW })] })).toHaveLength(1);
    expect(
      select({ sessions: [session("cs1", { startsAt: "2026-03-16T12:00:00.000Z" })] }),
    ).toEqual([]);
  });

  it("excludes sessions that are not scheduled", () => {
    expect(select({ sessions: [session("cs1", { status: "cancelled" })] })).toEqual([]);
  });

  it("excludes opted-out and unknown members", () => {
    expect(select({ members: [member("m1", { notificationsOptedOut: true })] })).toEqual([]);
    expect(select({ members: [] })).toEqual([]);
  });

  it("excludes bookings that already have a reminder", () => {
    expect(select({ alreadyRemindedBookingIds: new Set(["b1"]) })).toEqual([]);
  });
});
