import type { Repositories } from "@/lib/db/repos/types";
import { getMemberUpcomingBookedEvents } from "@/lib/domain/member-calendar";
import { toICalendar } from "@/lib/domain/ical";
import { HttpError } from "@/lib/http";

// Get a member's calendar feed by token. Resolves the token to a member (404 on
// empty/unknown token), gathers their upcoming booked sessions, and serializes
// to iCalendar format.

export async function getMemberCalendarByToken(
  repos: Repositories,
  studioId: string,
  token: string,
  now: string = new Date().toISOString(),
): Promise<string> {
  if (!token || token.trim() === "") {
    throw new HttpError(404, "not_found", "Calendar token not found");
  }

  const member = await repos.members.findByCalendarToken(token);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(404, "not_found", "Calendar token not found");
  }

  const sessions = await repos.classSessions.listByStudio(studioId, { from: now });
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const bookings = await repos.bookings.listBySessionIds(sessions.map((s) => s.id));

  const events = getMemberUpcomingBookedEvents(member, bookings, sessions, classTypes, now);
  const body = toICalendar(events, {
    calendarName: `${member.name}'s schedule`,
  });

  return body;
}
