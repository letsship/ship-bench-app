import type { Booking, ClassSession, Member } from "@/lib/db/types";

export interface BookingToRemind {
  booking: Booking;
  member: Member;
  session: ClassSession;
}

interface SelectInput {
  sessions: ClassSession[];
  bookings: Booking[];
  members: Map<string, Member>;
  alreadyRemindedBookingIds: Set<string>;
  now: string;
}

export function selectBookingsToRemind(input: SelectInput): BookingToRemind[] {
  const result: BookingToRemind[] = [];
  const now = new Date(input.now).getTime();

  for (const session of input.sessions) {
    // Filter: session must not be cancelled
    if (session.status !== "scheduled") continue;

    const sessionStartTime = new Date(session.startsAt).getTime();
    const windowStart = now;
    const windowEnd = now + 24 * 60 * 60 * 1000;

    // Filter: session must start within [now, now+24h)
    if (sessionStartTime < windowStart || sessionStartTime >= windowEnd) continue;

    // Find all bookings for this session
    for (const booking of input.bookings) {
      if (booking.sessionId !== session.id) continue;

      // Filter: booking must be confirmed (status === 'booked', not 'waitlisted')
      if (booking.status !== "booked") continue;

      // Filter: booking must not already have a reminder queued
      if (input.alreadyRemindedBookingIds.has(booking.id)) continue;

      // Get the member
      const member = input.members.get(booking.memberId);
      if (!member) continue;

      // Filter: member must not have opted out of notifications
      if (member.notificationsOptedOut) continue;

      result.push({ booking, member, session });
    }
  }

  return result;
}
