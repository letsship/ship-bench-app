import type { Repositories } from "@/lib/db/repos/types";
import type { Member } from "@/lib/db/types";
import type { CalendarEvent } from "@/lib/domain/ical";

export async function getMemberCalendarEvents(
  repos: Repositories,
  member: Member,
  now: Date,
): Promise<CalendarEvent[]> {
  const bookings = await repos.bookings.listByMember(member.id);
  const confirmedBookings = bookings.filter((b) => b.status === "booked");

  const events: CalendarEvent[] = [];
  const nowIso = now.toISOString();
  const studio = await repos.studios.getFirst();

  for (const booking of confirmedBookings) {
    const session = await repos.classSessions.getById(booking.sessionId);
    if (!session || session.startsAt <= nowIso) continue;

    const classType = await repos.classTypes.getById(session.classTypeId);

    events.push({
      uid: `${booking.id}@studiobook`,
      title: classType?.name ?? "Class",
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: studio?.name ?? "Studio",
    });
  }

  return events;
}
