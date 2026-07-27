import type { Repositories } from "@/lib/db/repos/types";
import type { Member } from "@/lib/db/types";
import { type CalendarEvent } from "@/lib/domain/ical";
import { HttpError } from "@/lib/http";

export interface MemberCalendar {
  member: Member;
  events: CalendarEvent[];
}

// GET /api/ical/[token] — a private, per-member iCalendar feed. A calendar
// client can't send our session cookie, so the token itself is the sole
// authorization: an empty, malformed, or unknown token must 404, never leak
// another member's schedule.
export async function getMemberCalendar(
  repos: Repositories,
  token: string,
): Promise<MemberCalendar> {
  const trimmed = token.trim();
  if (!trimmed) throw new HttpError(404, "not_found", "Calendar not found");
  const member = await repos.members.findByCalendarToken(trimmed);
  if (!member) throw new HttpError(404, "not_found", "Calendar not found");

  const now = new Date().toISOString();
  const studio = await repos.studios.getFirst();
  const sessions = await repos.classSessions.listByStudio(member.studioId, { from: now });
  const classTypes = await repos.classTypes.listByStudio(member.studioId);
  const classTypeById = new Map(classTypes.map((classType) => [classType.id, classType]));
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));
  const bookedSessionIds = new Set(
    bookings
      .filter((booking) => booking.memberId === member.id && booking.status === "booked")
      .map((booking) => booking.sessionId),
  );

  const events: CalendarEvent[] = sessions
    .filter((session) => bookedSessionIds.has(session.id))
    .map((session) => ({
      uid: `${session.id}@studiobook`,
      title: classTypeById.get(session.classTypeId)?.name ?? "Class",
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: studio?.name,
    }));

  return { member, events };
}
