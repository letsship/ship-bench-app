import type { Repositories } from "@/lib/db/repos/types";
import type { Member, Studio } from "@/lib/db/types";
import type { CalendarEvent } from "@/lib/domain/ical";
import { HttpError } from "@/lib/http";
import { type SessionView, listSessions } from "./classes";

// A member's private calendar subscription. The secret token IS the
// authorization — a calendar client (Apple/Google Calendar) cannot send our
// session cookie — so an unknown or empty token must resolve to a 404 rather
// than any hint that the token was close, or anyone else's schedule.

export interface MemberCalendar {
  member: Member;
  events: CalendarEvent[];
}

// A confirmed seat, per lib/domain/booking-rules: 'waitlisted' holds no seat,
// and 'attended' / 'no_show' / 'cancelled' never apply to a future session.
const CONFIRMED = "booked";

// A distinct UID namespace from the public /api/ical feed, so a member who
// subscribes to both doesn't have one feed's events dedupe away the other's.
function toEvent(session: SessionView, studio: Studio): CalendarEvent {
  return {
    uid: `${session.id}@member.studiobook`,
    title: session.classTypeName,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    description: `Instructor: ${session.instructor}`,
    location: studio.name,
  };
}

async function requireMemberByToken(
  repos: Repositories,
  studio: Studio,
  token: string,
): Promise<Member> {
  // One indistinguishable 404 for every failure mode — an empty token, a made-up
  // one, and one belonging to another studio must all look identical.
  const notFound = () => new HttpError(404, "not_found", "Calendar not found");
  if (!token.trim()) throw notFound();
  const member = await repos.members.findByCalendarToken(token);
  if (!member || member.studioId !== studio.id) throw notFound();
  return member;
}

// Resolve a subscription token to its owner and build calendar events for that
// member's upcoming confirmed sessions — nobody else's, and nothing in the past.
export async function getMemberCalendar(
  repos: Repositories,
  studio: Studio,
  token: string,
  now: Date = new Date(),
): Promise<MemberCalendar> {
  const member = await requireMemberByToken(repos, studio, token);
  const upcoming = await listSessions(repos, studio.id, { from: now.toISOString() });
  const bookings = await repos.bookings.listBySessionIds(upcoming.map((session) => session.id));
  const booked = new Set(
    bookings
      .filter((booking) => booking.memberId === member.id && booking.status === CONFIRMED)
      .map((booking) => booking.sessionId),
  );
  const events = upcoming
    .filter((session) => booked.has(session.id))
    .map((session) => toEvent(session, studio));
  return { member, events };
}
