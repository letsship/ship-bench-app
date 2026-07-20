import type { Repositories } from "@/lib/db/repos/types";
import { HttpError } from "@/lib/http";
import { listSessions } from "@/lib/services/classes";
import type { CalendarEvent } from "@/lib/domain/ical";

export interface MemberCalendar {
  events: CalendarEvent[];
  calendarName: string;
}

export async function buildMemberCalendar(
  repos: Repositories,
  token: string,
): Promise<MemberCalendar> {
  if (!token) {
    throw new HttpError(404, "not_found", "Calendar subscription not found");
  }

  const member = await repos.members.findByToken(token);
  if (!member) {
    throw new HttpError(404, "not_found", "Calendar subscription not found");
  }

  const studio = await repos.studios.getFirst();
  if (!studio) {
    throw new HttpError(404, "not_found", "Studio not found");
  }

  const sessions = await listSessions(repos, member.studioId, {
    from: new Date().toISOString(),
  });

  if (sessions.length === 0) {
    return {
      events: [],
      calendarName: `${member.name}'s ${studio.name} schedule`,
    };
  }

  const sessionIds = sessions.map((s) => s.id);
  const bookings = await repos.bookings.listBySessionIds(sessionIds);
  const memberBookings = bookings.filter((b) => b.memberId === member.id && b.status === "booked");
  const bookedSessionIds = new Set(memberBookings.map((b) => b.sessionId));

  const events: CalendarEvent[] = sessions
    .filter((session) => bookedSessionIds.has(session.id))
    .map((session) => ({
      uid: `${session.id}@studiobook`,
      title: session.classTypeName,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: studio.name,
    }));

  return {
    events,
    calendarName: `${member.name}'s ${studio.name} schedule`,
  };
}
