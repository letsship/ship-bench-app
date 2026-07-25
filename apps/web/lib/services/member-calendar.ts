import type { Repositories } from "@/lib/db/repos/types";
import type { CalendarEvent } from "@/lib/domain/ical";
import { HttpError } from "@/lib/http";

// Resolve a member by calendar token, load their upcoming booked sessions,
// and return them as CalendarEvent[] ready for iCalendar serialization.
// Unknown or empty token returns 404 without leaking another member's schedule.
export async function getMemberCalendarEvents(
  repos: Repositories,
  token: string,
  now: Date = new Date(),
): Promise<CalendarEvent[]> {
  if (!token) {
    throw new HttpError(404, "not_found", "Calendar token not found");
  }

  const member = await repos.members.findByCalendarToken(token);
  if (!member) {
    throw new HttpError(404, "not_found", "Calendar token not found");
  }

  const bookings = await repos.bookings.listByMember(member.id);
  const nowIso = now.toISOString();

  // Keep only confirmed seats (status === 'booked', not cancelled).
  const confirmedBookings = bookings.filter((b) => b.status === "booked" && b.cancelledAt === null);

  if (confirmedBookings.length === 0) {
    return [];
  }

  // Load all referenced sessions and class types.
  const sessionIds = confirmedBookings.map((b) => b.sessionId);
  const sessions = await Promise.all(sessionIds.map((id) => repos.classSessions.getById(id)));
  const classTypeIds = new Set(sessions.flatMap((s) => (s ? [s.classTypeId] : [])));
  const classTypes = await Promise.all(
    Array.from(classTypeIds).map((id) => repos.classTypes.getById(id)),
  );
  const typeById = new Map(classTypes.flatMap((t) => (t ? [[t.id, t]] : [])));

  // Filter to future sessions only and map to CalendarEvent[].
  return sessions
    .flatMap((session) =>
      session && session.startsAt > nowIso
        ? [
            {
              uid: `${session.id}@studiobook`,
              title: typeById.get(session.classTypeId)?.name ?? "Class",
              startsAt: session.startsAt,
              endsAt: session.endsAt,
              description: `Instructor: ${session.instructor}`,
              location: member.studioId, // placeholder; actual studio name will be used in route
            },
          ]
        : [],
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
