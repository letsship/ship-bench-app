import type { Repositories } from "@/lib/db/repos/types";
import { isSeatTaking } from "@/lib/domain/capacity";
import type { CalendarEvent } from "@/lib/domain/ical";
import { listSessions } from "@/lib/services/classes";

// A member's private calendar feed: only the sessions THEY hold a seat in,
// scoped by the secret calendarToken (the URL is the only authorization — see
// app/api/ical/[token]/route.ts). Returns null on an unknown token so the
// route can 404 without leaking whether a token ever existed.
export async function getMemberCalendarEvents(
  repos: Repositories,
  token: string,
  now: Date,
): Promise<CalendarEvent[] | null> {
  const member = await repos.members.findByCalendarToken(token);
  if (!member) return null;

  const studio = await repos.studios.getFirst();
  const sessions = await listSessions(repos, member.studioId, { from: now.toISOString() });
  const bookings = await repos.bookings.listByMember(member.id);
  const bookedSessionIds = new Set(
    bookings.filter((booking) => isSeatTaking(booking.status)).map((booking) => booking.sessionId),
  );

  return sessions
    .filter((session) => bookedSessionIds.has(session.id))
    .map((session) => ({
      uid: `${session.id}@studiobook`,
      title: session.classTypeName,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: studio?.name,
    }));
}
