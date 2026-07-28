// Per-member private calendar feed service. Resolves a secret token to a
// member, then returns only that member's future booked sessions as iCalendar
// events. Pure domain + repository composition — no framework or request imports.

import { type CalendarEvent } from "@/lib/domain/ical";
import { HttpError } from "@/lib/http";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, Booking } from "@/lib/db/types";

function isFutureBooked(booking: Booking, sessionsById: Map<string, ClassSession>, cutoff: Date): boolean {
  if (booking.status !== "booked") return false;
  const session = sessionsById.get(booking.sessionId);
  return session != null && new Date(session.startsAt).getTime() > cutoff.getTime();
}

function toEvent(
  booking: Booking,
  session: ClassSession,
  classTypeName: string,
  studioName: string,
): CalendarEvent {
  return {
    uid: `${session.id}-${booking.id}@studiobook`,
    title: classTypeName,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    description: `Instructor: ${session.instructor}`,
    location: studioName,
  };
}

export async function getMemberCalendarFeed(
  repos: Repositories,
  token: string,
  now?: Date,
): Promise<{ events: CalendarEvent[]; memberName: string; studioName: string }> {
  // Guard against empty/whitespace tokens — never leak member existence.
  if (!token || token.trim().length === 0) {
    throw new HttpError(404, "not_found", "Calendar not found");
  }

  const member = await repos.members.findByCalendarToken(token);
  if (!member) {
    throw new HttpError(404, "not_found", "Calendar not found");
  }

  const cutoff = now ?? new Date();

  // Load the studio for the location field.
  const studio = await repos.studios.getFirst();
  const studioName = studio?.name ?? "Studiobook";

  // Load all sessions to resolve booking.sessionId → ClassSession.
  const allSessions = await repos.classSessions.listByStudio(member.studioId);
  const sessionsById = new Map(allSessions.map((s) => [s.id, s]));

  // Load class types to resolve session.classTypeId → name.
  const classTypes = await repos.classTypes.listByStudio(member.studioId);
  const classTypeById = new Map(classTypes.map((ct) => [ct.id, ct]));

  // Load the member's bookings.
  const bookings = await repos.bookings.listByMember(member.id);

  const events: CalendarEvent[] = [];

  for (const booking of bookings) {
    if (!isFutureBooked(booking, sessionsById, cutoff)) continue;
    const session = sessionsById.get(booking.sessionId)!;
    const classType = classTypeById.get(session.classTypeId);
    events.push(toEvent(booking, session, classType?.name ?? "Class", studioName));
  }

  // Sort by startsAt so the calendar is ordered.
  events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return { events, memberName: member.name, studioName: studioName };
}