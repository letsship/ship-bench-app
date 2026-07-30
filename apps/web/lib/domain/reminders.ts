import { hoursBetween } from "./dates";

// When a class-reminder is due. Pure so the reminder job and its tests share one
// rule: a session qualifies while it is still ahead of us and starts no later
// than `hours` from now. A session that has already started is never reminded.

export const REMINDER_WINDOW_HOURS = 24;

export function isWithinReminderWindow(
  startsAt: string,
  now: string,
  hours: number = REMINDER_WINDOW_HOURS,
): boolean {
  const until = hoursBetween(now, startsAt);
  return until >= 0 && until <= hours;
}
