import { isSeatTaking } from "@/lib/domain/capacity";
import type { CalendarEvent } from "@/lib/domain/ical";
import type { Repositories } from "@/lib/db/repos/types";
import type { Member } from "@/lib/db/types";

// Private per-member calendar subscription. A member's secret `calendarToken`
// in the URL authorizes a cookieless feed of their upcoming booked sessions.
// Pure composition over the repositories (DI-style) — no framework imports.

export interface MemberCalendarFeed {
  member: Member;
  events: CalendarEvent[];
}

// Resolve the token-holder's upcoming seat-taking sessions as calendar events.
// Returns null for an empty or unknown token so the route can 404 — no schedule
// ever leaks for a made-up token.
export async function getMemberCalendarEvents(
  repos: Repositories,
  token: string,
): Promise<MemberCalendarFeed | null> {
  if (!token) return null;
  const member = await repos.members.findByCalendarToken(token);
  if (!member) return null;

  const bookings = (await repos.bookings.listByMember(member.id)).filter((booking) =>
    isSeatTaking(booking.status),
  );

  const classTypes = await repos.classTypes.listByStudio(member.studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));

  const nowIso = new Date().toISOString();
  const events: CalendarEvent[] = [];
  for (const booking of bookings) {
    const session = await repos.classSessions.getById(booking.sessionId);
    if (!session) continue;
    if (session.startsAt < nowIso) continue;
    const classType = typeById.get(session.classTypeId);
    events.push({
      uid: `${session.id}@studiobook`,
      title: classType?.name ?? "Class",
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
    });
  }
  events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { member, events };
}
