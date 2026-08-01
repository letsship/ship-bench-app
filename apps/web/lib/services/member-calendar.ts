import type { Repositories } from "@/lib/db/repos/types";
import type { Member } from "@/lib/db/types";
import { isSeatTaking } from "@/lib/domain/capacity";
import type { CalendarEvent } from "@/lib/domain/ical";
import { listSessions } from "./classes";

export interface MemberCalendarFeed {
  member: Member;
  events: CalendarEvent[];
}

// Build the private per-member calendar feed for /api/ical/[token]. The token
// is the sole authorization: a blank or unknown token yields null (the route
// turns that into a 404) so a guessed URL never reveals whether it was close.
// Events cover only the member's upcoming seat-holding bookings — waitlisted
// and cancelled bookings don't appear, and neither do past sessions.
export async function buildMemberCalendarFeed(
  repos: Repositories,
  token: string,
  nowIso: string,
): Promise<MemberCalendarFeed | null> {
  const secret = token.trim();
  if (!secret) return null;
  const member = await repos.members.findByCalendarToken(secret);
  if (!member) return null;

  const bookings = await repos.bookings.listByMember(member.id);
  const bookedSessionIds = new Set(
    bookings.filter((booking) => isSeatTaking(booking.status)).map((booking) => booking.sessionId),
  );
  const studio = await repos.studios.getFirst();
  const upcoming = await listSessions(repos, member.studioId, { from: nowIso });
  const events = upcoming
    .filter((session) => bookedSessionIds.has(session.id))
    .map((session) => ({
      uid: `${session.id}@studiobook`,
      title: session.classTypeName,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: studio?.name,
    }));
  return { member, events };
}
