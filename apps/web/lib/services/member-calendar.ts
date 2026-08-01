import type { Repositories } from "@/lib/db/repos/types";
import type { Member } from "@/lib/db/types";
import type { CalendarEvent } from "@/lib/domain/ical";

// A member's private calendar feed. Calendar clients cannot send our session
// cookie, so the per-member secret token is the sole authorization: an empty or
// unknown token resolves to null and the route answers 404 — it must never
// fall back to another member's (or the whole studio's) schedule.

export async function resolveMemberByToken(
  repos: Repositories,
  studioId: string,
  token: string,
): Promise<Member | null> {
  if (!token) return null;
  const member = await repos.members.findByCalendarToken(token);
  return member && member.studioId === studioId ? member : null;
}

export interface MemberCalendarOptions {
  // ISO timestamp separating past from upcoming sessions.
  now: string;
  location?: string;
}

// Only confirmed seats (status "booked") on upcoming sessions appear in the
// feed; waitlisted/cancelled/attended/no-show bookings and past sessions are
// omitted.
export async function listMemberUpcomingEvents(
  repos: Repositories,
  member: Member,
  options: MemberCalendarOptions,
): Promise<CalendarEvent[]> {
  const bookings = await repos.bookings.listByMember(member.id);
  const bookedSessionIds = new Set(
    bookings.filter((booking) => booking.status === "booked").map((booking) => booking.sessionId),
  );
  if (bookedSessionIds.size === 0) return [];
  const sessions = await repos.classSessions.listByStudio(member.studioId, { from: options.now });
  const typeById = new Map(
    (await repos.classTypes.listByStudio(member.studioId)).map((type) => [type.id, type]),
  );
  return sessions
    .filter((session) => bookedSessionIds.has(session.id))
    .map((session) => ({
      uid: `${session.id}@studiobook`,
      title: typeById.get(session.classTypeId)?.name ?? "Class",
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: options.location,
    }));
}
