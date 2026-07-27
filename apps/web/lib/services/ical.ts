import type { Repositories } from "@/lib/db/repos/types";
import type { Studio } from "@/lib/db/types";
import { SEAT_TAKING_STATUSES } from "@/lib/domain/capacity";
import { type CalendarEvent, toICalendar } from "@/lib/domain/ical";
import { HttpError } from "@/lib/http";

export async function buildMemberCalendar(
  repos: Repositories,
  studio: Studio,
  token: string,
): Promise<string> {
  if (!token || token.trim().length === 0) {
    throw new HttpError(404, "not_found", "Invalid calendar token");
  }

  const member = await repos.members.findByCalendarToken(token);
  if (!member) {
    throw new HttpError(404, "not_found", "Calendar token not found");
  }

  const now = new Date().toISOString();
  const sessions = await repos.classSessions.listByStudio(studio.id, { from: now });

  if (sessions.length === 0) {
    const events: CalendarEvent[] = [];
    return toICalendar(events, { calendarName: `${member.name} classes @ ${studio.name}` });
  }

  const sessionIds = sessions.map((s) => s.id);
  const bookings = await repos.bookings.listBySessionIds(sessionIds);

  const memberBookingsBySessionId = new Map<string, string>();
  for (const booking of bookings) {
    if (booking.memberId === member.id) {
      memberBookingsBySessionId.set(booking.sessionId, booking.status);
    }
  }

  const events: CalendarEvent[] = [];
  for (const session of sessions) {
    const bookingStatus = memberBookingsBySessionId.get(session.id);
    if (!bookingStatus) continue;
    if (!SEAT_TAKING_STATUSES.includes(bookingStatus as never)) continue;

    const classType = await repos.classTypes.getById(session.classTypeId);
    events.push({
      uid: `${session.id}@studiobook`,
      title: classType?.name ?? "Class",
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: studio.name,
    });
  }

  return toICalendar(events, { calendarName: `${member.name} classes @ ${studio.name}` });
}
