import type { Repositories } from "@/lib/db/repos/types";
import { type CalendarEvent } from "@/lib/domain/ical";

export async function memberCalendarEvents(
  repos: Repositories,
  studioId: string,
  token: string,
  now: Date,
): Promise<CalendarEvent[] | null> {
  const calendarToken = token.trim();
  if (!calendarToken) return null;

  const member = await repos.members.findByCalendarToken(calendarToken);
  if (!member || member.studioId !== studioId) return null;

  const nowIso = now.toISOString();
  const [sessions, classTypes] = await Promise.all([
    repos.classSessions.listByStudio(studioId, { from: nowIso }),
    repos.classTypes.listByStudio(studioId),
  ]);
  const upcomingSessions = sessions.filter((session) => session.startsAt > nowIso);
  const bookings = await repos.bookings.listBySessionIds(upcomingSessions.map((session) => session.id));
  const bookedSessionIds = new Set(
    bookings
      .filter((booking) => booking.memberId === member.id && booking.status === "booked")
      .map((booking) => booking.sessionId),
  );
  const classTypeById = new Map(classTypes.map((classType) => [classType.id, classType]));

  return upcomingSessions
    .filter((session) => bookedSessionIds.has(session.id))
    .map((session) => ({
      uid: `${session.id}@studiobook`,
      title: classTypeById.get(session.classTypeId)?.name ?? "Class",
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
    }));
}
