import type { Repositories } from "@/lib/db/repos/types";
import type { Member } from "@/lib/db/types";
import { isSeatTaking } from "@/lib/domain/capacity";
import type { CalendarEvent } from "@/lib/domain/ical";

// Builds a member's own private calendar feed: their upcoming sessions where
// they hold a seat-taking booking (booked / attended / no_show — never
// waitlisted, and never another member's or a past session).
export async function listMemberCalendarEvents(
  repos: Repositories,
  member: Member,
): Promise<CalendarEvent[]> {
  const [sessions, classTypes] = await Promise.all([
    repos.classSessions.listByStudio(member.studioId, { from: new Date().toISOString() }),
    repos.classTypes.listByStudio(member.studioId),
  ]);
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));
  const bookedSessionIds = new Set(
    bookings
      .filter((booking) => booking.memberId === member.id && isSeatTaking(booking.status))
      .map((booking) => booking.sessionId),
  );
  const classTypeById = new Map(classTypes.map((classType) => [classType.id, classType]));
  return sessions
    .filter((session) => bookedSessionIds.has(session.id))
    .map((session) => ({
      uid: `${session.id}@studiobook`,
      title: classTypeById.get(session.classTypeId)?.name ?? "Class",
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
    }));
}
