import type { Repositories } from "@/lib/db/repos/types";
import type { CalendarEvent } from "@/lib/domain/ical";
import { HttpError } from "@/lib/http";
import { listSessions } from "./classes";
import type { StudioContext } from "./studio";

// The private per-member calendar feed. A calendar app cannot log in, so the
// secret token in the URL is the whole authorization: anything that does not
// resolve to exactly one member must 404 rather than hint at what exists.

const calendarNotFound = (): HttpError =>
  new HttpError(404, "not_found", "No calendar found for this token");

// Only a confirmed seat belongs on the member's calendar — waitlisted,
// cancelled, attended and no_show bookings do not.
const CONFIRMED_STATUS = "booked";

// Upcoming sessions the token-holder holds a confirmed seat in, as calendar
// events. Scoped twice over: `from: now` drops past sessions, and the booking
// filter drops every other member's, so no one else's schedule can leak.
export async function memberCalendarEvents(
  repos: Repositories,
  ctx: StudioContext,
  token: string,
  now: Date = new Date(),
): Promise<CalendarEvent[]> {
  const member = token.trim() ? await repos.members.findByToken(token) : null;
  if (!member || member.studioId !== ctx.studio.id) throw calendarNotFound();

  const sessions = await listSessions(repos, member.studioId, { from: now.toISOString() });
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));
  const booked = new Set(
    bookings
      .filter((booking) => booking.memberId === member.id && booking.status === CONFIRMED_STATUS)
      .map((booking) => booking.sessionId),
  );

  return sessions
    .filter((session) => booked.has(session.id))
    .map((session) => ({
      uid: `${session.id}@studiobook`,
      title: session.classTypeName,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: ctx.studio.name,
    }));
}
