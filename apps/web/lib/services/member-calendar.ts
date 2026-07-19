import type { Repositories } from "@/lib/db/repos/types";
import { HttpError } from "@/lib/http";
import { filterUpcomingBookedSessions } from "@/lib/domain/member-calendar";
import { type CalendarEvent, toICalendar } from "@/lib/domain/ical";
import type { StudioContext } from "@/lib/services/studio";

export async function getMemberCalendarFeed(
  repos: Repositories,
  ctx: StudioContext,
  token: string,
  now: Date,
): Promise<string> {
  // Blank or empty token must 404, never leak someone else's schedule.
  if (!token || token.trim() === "") {
    throw new HttpError(404, "not_found", "Calendar feed not found");
  }

  // Resolve member by token, or 404 if not found.
  const member = await repos.members.findByCalendarToken(token);
  if (!member) {
    throw new HttpError(404, "not_found", "Calendar feed not found");
  }

  // Load upcoming sessions for this studio and the member's bookings.
  const sessions = await repos.classSessions.listByStudio(ctx.studio.id, {
    from: now.toISOString(),
  });
  const bookings = await repos.bookings.listByMember(member.id);

  // Filter to only upcoming sessions where the member holds a seat.
  const bookedSessions = filterUpcomingBookedSessions(sessions, bookings, now);

  // Map to calendar events and serialize to iCalendar format.
  const classTypes = await repos.classTypes.listByStudio(ctx.studio.id);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));

  const events: CalendarEvent[] = bookedSessions.map((session) => {
    const classType = typeById.get(session.classTypeId);
    return {
      uid: `${session.id}@studiobook`,
      title: classType?.name ?? "Class",
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: ctx.studio.name,
    };
  });

  return toICalendar(events, { calendarName: `${member.name} - ${ctx.studio.name}` });
}
