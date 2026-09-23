// Public class roster for embedding on a studio's own marketing website.
// Studios asked to show who is coming to a class so members can see friends
// before booking, so the roster carries the attendee list alongside the class.

import type { Repositories } from "@/lib/db/repos/types";
import { computeOccupancy } from "@/lib/domain/capacity";

export interface PublicAttendee {
  id: string;
  name: string;
}

export interface PublicRosterEntry {
  title: string;
  startsAt: string;
  instructor: string;
  seatsAvailable: number;
  attendees: PublicAttendee[];
}

// GET-side helper for /api/public/roster. The caller may narrow the response to
// specific sessions, which the embed uses to render one class at a time.
export async function listPublicRoster(
  repos: Repositories,
  studioId: string,
  sessionIds?: string[],
): Promise<PublicRosterEntry[]> {
  const sessions = await repos.classSessions.listByStudio(studioId);
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const classTypeById = new Map(classTypes.map((ct) => [ct.id, ct]));

  // Only use session IDs that belong to the current studio, so a sessionId from
  // another studio cannot leak bookings for that studio's classes (AC-3).
  const studioSessionIds = new Set(sessions.map((s) => s.id));
  const requestedIds = sessionIds?.filter((id) => studioSessionIds.has(id)) ?? [];
  const ids = requestedIds.length > 0 ? requestedIds : Array.from(studioSessionIds);
  const bookings = await repos.bookings.listBySessionIds(ids);

  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((m) => [m.id, m]));

  const bookingsBySessionId = new Map<string, typeof bookings>();
  for (const booking of bookings) {
    const list = bookingsBySessionId.get(booking.sessionId) ?? [];
    list.push(booking);
    bookingsBySessionId.set(booking.sessionId, list);
  }

  return sessions
    .filter((session) => session.status !== "cancelled")
    .map((session) => {
      const classType = classTypeById.get(session.classTypeId);
      const sessionBookings = bookingsBySessionId.get(session.id) ?? [];
      const occupancy = computeOccupancy(session.capacity, sessionBookings);

      return {
        title: classType?.name ?? "Class",
        startsAt: session.startsAt,
        instructor: session.instructor,
        seatsAvailable: occupancy.available,
        // Only expose id and name so no private member data (email, phone) leaks
        // in the public embed (AC-1 & AC-2).
        attendees: sessionBookings.map((booking) => {
          const member = memberById.get(booking.memberId);
          return {
            id: booking.memberId,
            name: member?.name ?? "Member",
          };
        }),
      };
    });
}
