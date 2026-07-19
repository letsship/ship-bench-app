import type { Repositories } from "@/lib/db/repos/types";
import type { Member } from "@/lib/db/types";
import { type CalendarEvent } from "@/lib/domain/ical";
import { HttpError } from "@/lib/http";

// Fetch a member's upcoming booked sessions for their private calendar subscription.
// Returns only sessions the member has confirmed (status === 'booked'), not waitlisted
// or past sessions. An unknown or empty token throws 404 so schedule never leaks.
export async function getMemberUpcomingCalendar(
  repos: Repositories,
  token: string | undefined,
  now: Date,
): Promise<{ member: Member; events: CalendarEvent[] }> {
  const trimmed = token?.trim();
  if (!trimmed) throw new HttpError(404, "not_found", "Calendar subscription not found");

  const member = await repos.members.findByCalendarToken(trimmed);
  if (!member) throw new HttpError(404, "not_found", "Calendar subscription not found");

  const bookings = await repos.bookings.listByMember(member.id);
  const confirmedBookings = bookings.filter((b) => b.status === "booked");

  // Load all future sessions for the studio and class types for name lookup
  const sessions = await repos.classSessions.listByStudio(member.studioId, {
    from: now.toISOString(),
  });
  const classTypes = await repos.classTypes.listByStudio(member.studioId);

  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const typeById = new Map(classTypes.map((t) => [t.id, t]));

  const upcomingEvents: CalendarEvent[] = [];
  for (const booking of confirmedBookings) {
    const session = sessionById.get(booking.sessionId);
    if (!session || session.status === "cancelled") continue;

    const classType = typeById.get(session.classTypeId);
    upcomingEvents.push({
      uid: `${session.id}-${member.id}@studiobook`,
      title: classType?.name ?? "Class",
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
    });
  }

  return { member, events: upcomingEvents };
}
