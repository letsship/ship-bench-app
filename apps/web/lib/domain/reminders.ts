export interface SessionForReminder {
  id: string;
  startsAt: string;
  status: string;
}

export function isWithinReminderWindow(
  startsAt: string,
  now: string,
  windowHours = 24,
): boolean {
  const starts = new Date(startsAt).getTime();
  const nowMs = new Date(now).getTime();
  return nowMs < starts && starts <= nowMs + windowHours * 3_600_000;
}

export function selectSessionsDueForReminder(
  sessions: SessionForReminder[],
  now: string,
  windowHours = 24,
): SessionForReminder[] {
  return sessions.filter(
    (s) => s.status === "scheduled" && isWithinReminderWindow(s.startsAt, now, windowHours),
  );
}