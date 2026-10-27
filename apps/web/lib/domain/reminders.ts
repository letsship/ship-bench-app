// Pure rules for the 24-hour class reminder job. No framework, database, or
// email imports — services compose these with the repository seam.

export const REMINDER_WINDOW_HOURS = 24;

export interface ReminderWindow {
  from: string;
  to: string;
}

// The half-open window [now, now + 24h) of session start times that should
// receive a reminder.
export function reminderWindow(now: Date): ReminderWindow {
  return {
    from: now.toISOString(),
    to: new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000).toISOString(),
  };
}

// One reminder per booking, ever — the dedup key persisted on the outbox row.
export function reminderDedupKey(bookingId: string): string {
  return `booking_reminder:${bookingId}`;
}
