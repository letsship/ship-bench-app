import { selectUpcomingBookedSessions, toCalendarEvents } from "@/lib/domain/calendar-feed";
import { toICalendar } from "@/lib/domain/ical";
import type { Repositories } from "@/lib/db/repos/types";
import { HttpError } from "@/lib/http";

export async function getMemberCalendarFeed(
  repos: Repositories,
  token: string,
  studioName: string,
): Promise<string> {
  if (!token) {
    throw new HttpError(404, "not_found", "Calendar token not found");
  }

  const member = await repos.members.findByCalendarToken(token);
  if (!member) {
    throw new HttpError(404, "not_found", "Calendar token not found");
  }

  const bookings = await repos.bookings.listByMember(member.id);
  if (bookings.length === 0) {
    const events = toCalendarEvents([], new Map(), studioName);
    return toICalendar(events, { calendarName: `${studioName} - ${member.name}` });
  }

  const sessionIds = Array.from(new Set(bookings.map((b) => b.sessionId)));
  const sessionsByBookings = await Promise.all(
    sessionIds.map((id) => repos.classSessions.getById(id)),
  );

  const sessionsMap = new Map(
    sessionsByBookings.filter((s): s is NonNullable<typeof s> => s !== null).map((s) => [s.id, s]),
  );

  const now = new Date();
  const upcomingSessions = selectUpcomingBookedSessions(bookings, sessionsMap, now);

  const classTypeIds = Array.from(new Set(upcomingSessions.map((s) => s.classTypeId)));
  const classTypesData = await Promise.all(classTypeIds.map((id) => repos.classTypes.getById(id)));

  const classTypeNames = new Map(
    classTypesData
      .filter((ct): ct is NonNullable<typeof ct> => ct !== null)
      .map((ct) => [ct.id, ct.name]),
  );

  const events = toCalendarEvents(upcomingSessions, classTypeNames, studioName);
  return toICalendar(events, { calendarName: `${studioName} - ${member.name}` });
}
