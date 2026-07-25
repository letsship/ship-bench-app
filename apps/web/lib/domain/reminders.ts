// Pure domain helpers for the reminders feature.

export interface ReminderWindow {
  from: string;
  to: string;
}

// Calculate the 24-hour reminder window starting from the given ISO timestamp.
// Upper bound is exclusive to align with the repository's inRange semantics.
export function reminderWindow(nowIso: string): ReminderWindow {
  const now = new Date(nowIso);
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    from: nowIso,
    to: in24h.toISOString(),
  };
}

// Check if a booking status represents a confirmed seat (eligible for reminders).
export function isConfirmedSeat(status: string): boolean {
  return status === "booked";
}
