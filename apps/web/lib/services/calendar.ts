import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession } from "@/lib/db/types";
import { isSeatTaking } from "@/lib/domain/capacity";
import { type CalendarEvent, toICalendar } from "@/lib/domain/ical";

interface MemberCalendarOptions {
  now?: Date;
}

function isUpcoming(session: ClassSession, now: Date): boolean {
  return session.startsAt >= now.toISOString();
}

export async function memberCalendarFeed(
  repos: Repositories,
  token: string,
  options: MemberCalendarOptions = {},
): Promise<string | null> {
  if (token.trim().length === 0) return null;

  const member = await repos.members.findByCalendarToken(token);
  if (!member) return null;

  const now = options.now ?? new Date();
  const bookings = await repos.bookings.listByMember(member.id);
  const sessions = await Promise.all(
    bookings
      .filter((booking) => isSeatTaking(booking.status))
      .map((booking) => repos.classSessions.getById(booking.sessionId)),
  );
  const upcoming = sessions
    .filter((session): session is ClassSession => session !== null && isUpcoming(session, now))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const events: CalendarEvent[] = await Promise.all(
    upcoming.map(async (session) => {
      const classType = await repos.classTypes.getById(session.classTypeId);
      return {
        uid: `${session.id}@studiobook`,
        title: classType?.name ?? "Class",
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        description: `Instructor: ${session.instructor}`,
      };
    }),
  );

  return toICalendar(events, {
    calendarName: `${member.name}'s classes`,
    dtstamp: now.toISOString(),
  });
}
