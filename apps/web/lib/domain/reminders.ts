import { isBefore } from "./dates";

// Day-before class reminder policy. Pure decisions over minimal shapes so the
// reminder job and its tests share one rule, free of framework, database, and
// notification concerns.

export interface ReminderWindow {
  from: string;
  to: string;
}

// The window covering the next `hours` hours from `nowIso`. Half-open
// ([from, to)) to match the session repositories' range semantics.
export function reminderWindow(nowIso: string, hours = 24): ReminderWindow {
  const start = new Date(nowIso);
  if (Number.isNaN(start.getTime())) throw new RangeError(`Invalid ISO timestamp: ${nowIso}`);
  return {
    from: start.toISOString(),
    to: new Date(start.getTime() + hours * 3_600_000).toISOString(),
  };
}

export interface ReminderSession {
  id: string;
  startsAt: string;
  status: string;
}

export interface ReminderBooking {
  id: string;
  sessionId: string;
  memberId: string;
  status: string;
}

export interface ReminderMember {
  id: string;
  notificationsOptedOut: boolean;
}

export interface ReminderSelection {
  sessions: readonly ReminderSession[];
  bookings: readonly ReminderBooking[];
  members: readonly ReminderMember[];
  alreadyRemindedBookingIds: ReadonlySet<string>;
  from: string;
  to: string;
}

const startsInWindow = (session: ReminderSession, from: string, to: string): boolean =>
  !isBefore(session.startsAt, from) && isBefore(session.startsAt, to);

// The bookings that should receive a reminder: a confirmed seat in a scheduled
// session starting inside the window, held by a known member who has not opted
// out, and not already reminded (the idempotency check).
export function selectReminders(input: ReminderSelection): ReminderBooking[] {
  const eligibleSessionIds = new Set(
    input.sessions
      .filter((session) => session.status === "scheduled")
      .filter((session) => startsInWindow(session, input.from, input.to))
      .map((session) => session.id),
  );
  const reachableMemberIds = new Set(
    input.members.filter((member) => !member.notificationsOptedOut).map((member) => member.id),
  );
  return input.bookings.filter(
    (booking) =>
      booking.status === "booked" &&
      eligibleSessionIds.has(booking.sessionId) &&
      reachableMemberIds.has(booking.memberId) &&
      !input.alreadyRemindedBookingIds.has(booking.id),
  );
}
