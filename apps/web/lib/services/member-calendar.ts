import type { Repositories } from "@/lib/db/repos/types";
import { isSeatTaking } from "@/lib/domain/capacity";
import { type CalendarEvent, toICalendar } from "@/lib/domain/ical";

export interface MemberCalendarOptions {
  // Injectable "now" + DTSTAMP so tests are deterministic.
  now?: Date;
  dtstamp?: string;
}

// Build a private iCalendar feed of a single member's own upcoming booked
// sessions, authorized by their secret calendarToken (see
// app/api/ical/[token]/route.ts — there is no session cookie on this path).
// Returns null when the token does not resolve to a member, so the route can
// 404 without leaking whether the token was merely unknown vs malformed.
export async function buildMemberCalendarFeed(
  repos: Repositories,
  token: string,
  options: MemberCalendarOptions = {},
): Promise<string | null> {
  if (!token) return null;
  const member = await repos.members.getByCalendarToken(token);
  if (!member) return null;

  const now = options.now ?? new Date();
  const [bookings, sessions, classTypes, studio] = await Promise.all([
    repos.bookings.listByMember(member.id),
    repos.classSessions.listByStudio(member.studioId),
    repos.classTypes.listByStudio(member.studioId),
    repos.studios.getFirst(),
  ]);

  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const bookedSessionIds = new Set(
    bookings.filter((booking) => isSeatTaking(booking.status)).map((booking) => booking.sessionId),
  );

  const events: CalendarEvent[] = sessions
    .filter((session) => bookedSessionIds.has(session.id))
    .filter((session) => new Date(session.startsAt).getTime() > now.getTime())
    .map((session) => ({
      uid: `${session.id}@studiobook`,
      title: typeById.get(session.classTypeId)?.name ?? "Class",
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: studio?.name,
    }));

  return toICalendar(events, {
    calendarName: `${member.name}'s classes`,
    dtstamp: options.dtstamp,
  });
}
