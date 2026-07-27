import type { Booking, ClassSession } from "@/lib/db/types";
import type { CalendarEvent } from "./ical";

// Select only sessions that are upcoming and held via a confirmed (booked) seat.
export function selectUpcomingBookedSessions(
  bookings: Booking[],
  sessions: Map<string, ClassSession>,
  now: Date,
): ClassSession[] {
  const nowMs = now.getTime();
  const sessionMap = sessions;

  return bookings
    .filter((booking) => {
      if (booking.status !== "booked") return false;
      const session = sessionMap.get(booking.sessionId);
      if (!session) return false;
      return new Date(session.startsAt).getTime() >= nowMs;
    })
    .map((booking) => sessionMap.get(booking.sessionId)!)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// Map sessions to calendar events.
export function toCalendarEvents(
  sessions: ClassSession[],
  classTypeNames: Map<string, string>,
  studioName: string,
): CalendarEvent[] {
  return sessions.map((session) => ({
    uid: `${session.id}@studiobook`,
    title: classTypeNames.get(session.classTypeId) ?? "Class",
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    description: `Instructor: ${session.instructor}`,
    location: studioName,
  }));
}
