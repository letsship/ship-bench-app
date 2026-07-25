import type { Repositories } from "@/lib/db/repos/types";
import { seatTakenSessionIds } from "@/lib/domain/member-calendar";
import type { CalendarEvent } from "@/lib/domain/ical";
import { toICalendar } from "@/lib/domain/ical";
import { HttpError } from "@/lib/http";
import { listSessions } from "./classes";

export async function buildMemberCalendarFeed(
  repos: Repositories,
  studioId: string,
  token: string,
): Promise<string> {
  // Empty token → 404
  if (!token) throw new HttpError(404, "not_found", "Calendar token not found");

  // Look up member by token
  const member = await repos.members.findByCalendarToken(token);
  if (!member) throw new HttpError(404, "not_found", "Calendar token not found");

  // Verify member belongs to the studio
  if (member.studioId !== studioId) {
    throw new HttpError(404, "not_found", "Calendar token not found");
  }

  // Fetch member's bookings
  const memberBookings = await repos.bookings.listByMember(member.id);

  // Get session ids where the member holds a seat
  const memberSeatIds = seatTakenSessionIds(memberBookings);

  // List upcoming sessions for the studio
  const now = new Date().toISOString();
  const upcomingSessions = await listSessions(repos, studioId, { from: now });

  // Filter to only sessions the member has booked
  const memberSessions = upcomingSessions.filter((s) => memberSeatIds.has(s.id));

  // Convert to calendar events
  const events: CalendarEvent[] = memberSessions.map((session) => ({
    uid: `${session.id}@studiobook`,
    title: session.classTypeName,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    description: `Instructor: ${session.instructor}`,
    location: undefined,
  }));

  // Serialize to iCalendar format
  return toICalendar(events, { calendarName: `${member.name} classes` });
}
