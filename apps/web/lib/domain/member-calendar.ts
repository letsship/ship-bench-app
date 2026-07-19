// Pure business rule: select sessions that are (1) in the future and (2) in which
// the member holds a seat-taking booking. Used by the member calendar feed to
// return only the sessions that should appear on that member's personal calendar.

import { isSeatTaking } from "./capacity";
import type { ClassSession, Booking } from "../db/types";

export function filterUpcomingBookedSessions(
  sessions: readonly ClassSession[],
  memberBookings: readonly Booking[],
  now: Date,
): ClassSession[] {
  const nowMs = now.getTime();
  const bookingsBySessionId = new Map<string, Booking>();
  for (const booking of memberBookings) {
    if (isSeatTaking(booking.status)) {
      bookingsBySessionId.set(booking.sessionId, booking);
    }
  }
  return sessions.filter((session) => {
    const sessionTime = new Date(session.startsAt).getTime();
    return sessionTime > nowMs && bookingsBySessionId.has(session.id);
  });
}
