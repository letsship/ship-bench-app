import type { Repositories } from "@/lib/db/repos/types";
import type { Booking } from "@/lib/db/types";
import { isSeatTaking } from "@/lib/domain/capacity";

// A member's own upcoming confirmed classes, shaped for iCalendar
// serialization by the /api/ical/[token] route.
export interface MemberCalendarSession {
  sessionId: string;
  title: string;
  instructor: string;
  startsAt: string;
  endsAt: string;
}

// Confirmed = the booking holds (or held) a seat and was never cancelled.
// Waitlisted entries never held a seat, so they stay off the member's
// calendar; seat-taking semantics come from the shared capacity rules.
function isConfirmedSeat(booking: Booking): boolean {
  return isSeatTaking(booking.status) && booking.cancelledAt === null;
}

async function toCalendarSession(
  repos: Repositories,
  booking: Booking,
): Promise<MemberCalendarSession | null> {
  const session = await repos.classSessions.getById(booking.sessionId);
  if (!session) return null;
  const classType = await repos.classTypes.getById(session.classTypeId);
  return {
    sessionId: session.id,
    title: classType?.name ?? "Class",
    instructor: session.instructor,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
  };
}

// The sessions `memberId` holds a confirmed seat in that start at or after
// `now`, sorted by start time. Past sessions and other members' bookings are
// never touched — the query is scoped to this member from the start.
export async function listUpcomingBookedSessions(
  repos: Repositories,
  memberId: string,
  now: string,
): Promise<MemberCalendarSession[]> {
  const bookings = await repos.bookings.listByMember(memberId);
  const sessions = await Promise.all(
    bookings.filter(isConfirmedSeat).map((booking) => toCalendarSession(repos, booking)),
  );
  return sessions
    .filter((session): session is MemberCalendarSession => session !== null)
    .filter((session) => session.startsAt >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
