// Public class roster for embedding on a studio's own marketing website.
// Studios asked to show how busy a class is before members book, so the roster
// carries an anonymous attendee list alongside the class. The endpoint is
// unauthenticated, so everything below is deliberately minimised: an anonymous
// visitor on the open internet is the audience for every field here.

import type { Repositories } from "@/lib/db/repos/types";
import { computeOccupancy, isSeatTaking } from "@/lib/domain/capacity";

// Hard ceiling on the class sessions one public request may read. An
// unauthenticated caller decides how often this endpoint runs, so the read is
// capped at the database instead of growing with the studio's whole history.
// Sized far above any real embed page; a widget renders a handful of classes.
const MAX_ROSTER_SESSIONS = 200;

// Everything an anonymous visitor is allowed to learn about an attendee. This
// is the whole payload by declaration: never spread a database row into it, or
// the next `bookings` migration publishes its new column to the internet
// without anyone reviewing the decision.
export interface PublicAttendee {
  initials: string;
}

export interface PublicRosterEntry {
  title: string;
  startsAt: string;
  instructor: string;
  seatsAvailable: number;
  attendees: PublicAttendee[];
}

// First letter of up to two name parts — enough for the widget to render
// distinct avatars, not enough to identify or contact a member.
function toInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

// GET-side helper for /api/public/roster. The caller may narrow the response to
// specific sessions, which the embed uses to render one class at a time.
export async function listPublicRoster(
  repos: Repositories,
  studioId: string,
  sessionIds?: string[],
): Promise<PublicRosterEntry[]> {
  const sessions = await repos.classSessions.listByStudio(studioId, {
    limit: MAX_ROSTER_SESSIONS,
  });
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const classTypeById = new Map(classTypes.map((ct) => [ct.id, ct]));

  // The embed may ask for specific sessions, but only ones this studio owns:
  // intersecting against the studio-scoped list means a session id belonging to
  // another studio selects nothing and never reaches the bookings query.
  const requested = sessionIds && sessionIds.length > 0 ? new Set(sessionIds) : null;
  const visible = sessions.filter(
    (session) => session.status !== "cancelled" && (!requested || requested.has(session.id)),
  );
  const bookings = await repos.bookings.listBySessionIds(visible.map((s) => s.id));

  // Only the members actually booked into these sessions, so a public request
  // never pulls the studio's whole contact list into memory to render initials.
  const members = await repos.members.listByIds(studioId, [
    ...new Set(bookings.map((booking) => booking.memberId)),
  ]);
  const initialsByMemberId = new Map(members.map((m) => [m.id, toInitials(m.name)]));

  const bookingsBySessionId = new Map<string, typeof bookings>();
  for (const booking of bookings) {
    const list = bookingsBySessionId.get(booking.sessionId) ?? [];
    list.push(booking);
    bookingsBySessionId.set(booking.sessionId, list);
  }

  return visible.map((session) => {
    const sessionBookings = bookingsBySessionId.get(session.id) ?? [];
    const occupancy = computeOccupancy(session.capacity, sessionBookings);

    return {
      title: classTypeById.get(session.classTypeId)?.name ?? "Class",
      startsAt: session.startsAt,
      instructor: session.instructor,
      seatsAvailable: occupancy.available,
      // Each field is named explicitly, so the declared PublicAttendee shape —
      // not the booking row — decides what leaves the process. Only bookings
      // that hold a seat count as attending, now that the status is no longer
      // published for the caller to filter on.
      attendees: sessionBookings
        .filter((booking) => isSeatTaking(booking.status))
        .map((booking) => ({ initials: initialsByMemberId.get(booking.memberId) ?? "" })),
    };
  });
}
