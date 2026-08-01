import type { Repositories } from "@/lib/db/repos/types";
import type { Studio } from "@/lib/db/types";
import { isSeatTaking } from "@/lib/domain/capacity";
import type { CalendarEvent } from "@/lib/domain/ical";
import { HttpError } from "@/lib/http";

export async function getMemberCalendar(
  repos: Repositories,
  studio: Studio,
  token: string,
): Promise<CalendarEvent[]> {
  if (!token.trim()) throw new HttpError(404, "not_found", "Calendar not found");
  const member = await repos.members.findByCalendarToken(token);
  if (!member || member.studioId !== studio.id) {
    throw new HttpError(404, "not_found", "Calendar not found");
  }

  const now = new Date().toISOString();
  const bookings = (await repos.bookings.listByMember(member.id)).filter(
    (booking) => isSeatTaking(booking.status),
  );
  const events = await Promise.all(
    bookings.map(async (booking) => {
      const session = await repos.classSessions.getById(booking.sessionId);
      if (!session || session.studioId !== studio.id || session.startsAt < now) return null;
      const classType = await repos.classTypes.getById(session.classTypeId);
      return {
        uid: `${session.id}@studiobook`,
        title: classType?.name ?? "Class",
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        description: `Instructor: ${session.instructor}`,
        location: studio.name,
      } satisfies CalendarEvent;
    }),
  );
  return events
    .flatMap((event): CalendarEvent[] => (event ? [event] : []))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
