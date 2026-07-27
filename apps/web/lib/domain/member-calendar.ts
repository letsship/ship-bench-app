import { SEAT_TAKING_STATUSES } from "./capacity";
import type { CalendarEvent } from "./ical";

export interface SessionWithClassType {
  id: string;
  classTypeId: string;
  classTypeName: string;
  instructor: string;
  startsAt: string;
  endsAt: string;
}

export interface BookingForMember {
  sessionId: string;
  memberId: string;
  status: string;
}

export function memberCalendarEvents(
  memberId: string,
  now: string,
  sessions: SessionWithClassType[],
  bookings: BookingForMember[],
): CalendarEvent[] {
  const nowMs = new Date(now).getTime();
  const bookingsBySession = new Map<string, BookingForMember[]>();
  for (const booking of bookings) {
    const bucket = bookingsBySession.get(booking.sessionId);
    if (bucket) bucket.push(booking);
    else bookingsBySession.set(booking.sessionId, [booking]);
  }

  const events: CalendarEvent[] = [];
  for (const session of sessions) {
    const sessionMs = new Date(session.startsAt).getTime();
    if (sessionMs <= nowMs) continue;

    const sessionBookings = bookingsBySession.get(session.id) ?? [];
    const memberBooking = sessionBookings.find((b) => b.memberId === memberId);
    if (!memberBooking) continue;

    const status = memberBooking.status;
    if (!(SEAT_TAKING_STATUSES as readonly string[]).includes(status)) continue;

    events.push({
      uid: `${session.id}@studiobook`,
      title: session.classTypeName,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
    });
  }

  return events;
}
