import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";
import type { CalendarEvent } from "./ical";

// Build a member's upcoming booked calendar events.
// Given the member, their bookings, matching sessions, and class types, plus a 'now'
// ISO string, return CalendarEvent[] for only that member's upcoming booked sessions.

export function getMemberUpcomingBookedEvents(
  member: Member,
  bookings: Booking[],
  sessions: ClassSession[],
  classTypes: ClassType[],
  now: string,
): CalendarEvent[] {
  const nowMs = new Date(now).getTime();
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const typeById = new Map(classTypes.map((t) => [t.id, t]));

  const events: CalendarEvent[] = [];

  for (const booking of bookings) {
    if (booking.memberId !== member.id) continue;
    if (booking.status !== "booked") continue;

    const session = sessionById.get(booking.sessionId);
    if (!session) continue;

    const sessionStartMs = new Date(session.startsAt).getTime();
    if (sessionStartMs <= nowMs) continue;

    const classType = typeById.get(session.classTypeId);
    if (!classType) continue;

    events.push({
      uid: `${session.id}@studiobook`,
      title: classType.name,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
    });
  }

  return events;
}
