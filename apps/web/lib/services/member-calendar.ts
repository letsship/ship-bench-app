import type { Repositories } from "@/lib/db/repos/types";
import { isSeatTaking } from "@/lib/domain/capacity";
import { type CalendarEvent } from "@/lib/domain/ical";

// Per-member calendar subscription service. Resolves the member behind a
// private calendar token and returns ONLY that member's upcoming seat-taking
// sessions as iCalendar events. An unknown / empty token resolves to null so
// the route can 404 without leaking anyone else's schedule.

export interface MemberCalendarResult {
  member: { id: string; name: string };
  events: CalendarEvent[];
}

export async function getMemberCalendarByToken(
  repos: Repositories,
  studioName: string,
  token: string,
  now: Date = new Date(),
): Promise<MemberCalendarResult | null> {
  if (!token) return null;
  const member = await repos.members.findByIcalToken(token);
  if (!member) return null;

  const bookings = (await repos.bookings.listByMember(member.id)).filter((booking) =>
    isSeatTaking(booking.status),
  );
  if (bookings.length === 0) return { member: { id: member.id, name: member.name }, events: [] };

  const sessionIds = [...new Set(bookings.map((booking) => booking.sessionId))];
  const sessions = (
    await Promise.all(sessionIds.map((id) => repos.classSessions.getById(id)))
  ).filter((session): session is NonNullable<typeof session> => session !== null);

  const classTypeIds = [...new Set(sessions.map((session) => session.classTypeId))];
  const classTypes = (
    await Promise.all(classTypeIds.map((id) => repos.classTypes.getById(id)))
  ).filter((type): type is NonNullable<typeof type> => type !== null);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));

  const nowIso = now.toISOString();
  const upcoming = sessions
    .filter((session) => session.startsAt >= nowIso)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const events: CalendarEvent[] = upcoming.map((session) => ({
    uid: `${session.id}@studiobook`,
    title: typeById.get(session.classTypeId)?.name ?? "Class",
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    description: `Instructor: ${session.instructor}`,
    location: studioName,
  }));

  return { member: { id: member.id, name: member.name }, events };
}
