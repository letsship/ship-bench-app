import type { Repositories } from "@/lib/db/repos/types";
import type { CalendarEvent } from "@/lib/domain/ical";

// Per-member private calendar feed. The secret token in the URL is the only
// authorization (calendar clients can't send our session cookie), so an
// unknown or blank token must resolve to null — the route turns that into a
// 404 and no schedule ever leaks.
export async function getMemberCalendarEvents(
  repos: Repositories,
  studioId: string,
  token: string,
): Promise<CalendarEvent[] | null> {
  if (!token.trim()) return null;
  const member = await repos.members.findByCalendarToken(token);
  if (!member || member.studioId !== studioId) return null;

  const sessions = await repos.classSessions.listByStudio(studioId, {
    from: new Date().toISOString(),
  });
  const bookings = await repos.bookings.listBySessionIds(sessions.map((s) => s.id));
  // Only confirmed seats count — waitlisted and cancelled bookings don't
  // appear on the member's calendar.
  const confirmedSessionIds = new Set(
    bookings
      .filter((b) => b.memberId === member.id && b.status === "booked")
      .map((b) => b.sessionId),
  );
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const classTypeById = new Map(classTypes.map((ct) => [ct.id, ct]));

  return sessions
    .filter((session) => confirmedSessionIds.has(session.id))
    .map((session) => ({
      uid: `${session.id}@studiobook`,
      title: classTypeById.get(session.classTypeId)?.name ?? "Class",
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
    }));
}
