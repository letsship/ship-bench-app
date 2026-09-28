// Public class roster for embedding on a studio's own marketing website.
// Studios asked to show who is coming to a class so members can see friends
// before booking, so the roster carries the attendee list alongside the class.

import type { Repositories, SessionRange } from "@/lib/db/repos/types";
import { computeOccupancy, isSeatTaking } from "@/lib/domain/capacity";

export interface PublicRosterEntry {
  title: string;
  startsAt: string;
  instructor: string;
  seatsAvailable: number;
  attendeeCount: number;
}

// GET-side helper for /api/public/roster. The caller may narrow the response to
// specific sessions, which the embed uses to render one class at a time.
export async function listPublicRoster(
  repos: Repositories,
  studioId: string,
  sessionIds?: string[],
): Promise<PublicRosterEntry[]> {
  // Only show upcoming sessions to prevent DoS from unbounded historical reads
  const range: SessionRange = { from: new Date().toISOString() };
  const sessions = await repos.classSessions.listByStudio(studioId, range);
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const classTypeById = new Map(classTypes.map((ct) => [ct.id, ct]));

  // Only use session IDs that belong to the current studio, so a sessionId from
  // another studio cannot leak bookings for that studio's classes (AC-3).
  const studioSessionIds = new Set(sessions.map((s) => s.id));
  const requestedIds = sessionIds
    ? new Set(sessionIds.filter((id) => studioSessionIds.has(id)))
    : undefined;
  // Fail closed: if sessionIds were supplied but none match, return empty
  if (sessionIds && (!requestedIds || requestedIds.size === 0)) {
    return [];
  }
  const ids =
    requestedIds && requestedIds.size > 0 ? Array.from(requestedIds) : Array.from(studioSessionIds);
  const bookings = await repos.bookings.listBySessionIds(ids);

  const bookingsBySessionId = new Map<string, typeof bookings>();
  for (const booking of bookings) {
    const list = bookingsBySessionId.get(booking.sessionId) ?? [];
    list.push(booking);
    bookingsBySessionId.set(booking.sessionId, list);
  }

  return sessions
    .filter((session) => session.status !== "cancelled")
    .filter((session) => !requestedIds || requestedIds.has(session.id))
    .map((session) => {
      const classType = classTypeById.get(session.classTypeId);
      const sessionBookings = bookingsBySessionId.get(session.id) ?? [];
      const occupancy = computeOccupancy(session.capacity, sessionBookings);
      // Only count seat-taking attendees: booked, attended, no_show
      // Exclude cancelled and waitlisted (AC-1)
      const attendeeCount = sessionBookings.filter((b) => isSeatTaking(b.status)).length;

      return {
        title: classType?.name ?? "Class",
        startsAt: session.startsAt,
        instructor: session.instructor,
        seatsAvailable: occupancy.available,
        attendeeCount,
      };
    });
}
