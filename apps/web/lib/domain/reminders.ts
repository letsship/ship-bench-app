export interface ReminderWindow {
  from: string;
  to: string;
}

export function reminderWindow(nowIso: string, hours = 24): ReminderWindow {
  return {
    from: nowIso,
    to: new Date(new Date(nowIso).getTime() + hours * 60 * 60 * 1000).toISOString(),
  };
}

export function isConfirmedSeat(status: string): boolean {
  return status === "booked";
}
