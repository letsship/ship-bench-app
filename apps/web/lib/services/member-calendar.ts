import type { Repositories } from "@/lib/db/repos/types";
import { isSeatTaking } from "@/lib/domain/capacity";
import type { CalendarEvent } from "@/lib/domain/ical";
import { HttpError } from "@/lib/http";

// A member's private calendar feed: only their own upcoming, seat-taking
// bookings. The token is the sole authorization (calendar clients can't send
// our session cookie), so an empty or unknown token 404s exactly like any
// other missing resource — it must not reveal whether a token almost matched.
export async function buildMemberCalendarEvents(
  repos: Repositories,
  studioName: string,
  token: string,
): Promise<CalendarEvent[]> {
  const trimmed = token.trim();
  if (!trimmed) throw new HttpError(404, "not_found", "Calendar not found");
  const member = await repos.members.getByCalendarToken(trimmed);
  if (!member) throw new HttpError(404, "not_found", "Calendar not found");

  const bookings = await repos.bookings.listByMember(member.id);
  const seatTaking = bookings.filter((booking) => isSeatTaking(booking.status));
  const now = new Date().toISOString();

  const classTypes = await repos.classTypes.listByStudio(member.studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));

  const events: CalendarEvent[] = [];
  for (const booking of seatTaking) {
    const session = await repos.classSessions.getById(booking.sessionId);
    if (!session || session.startsAt <= now) continue;
    const classType = typeById.get(session.classTypeId);
    events.push({
      uid: `${session.id}@studiobook`,
      title: classType?.name ?? "Class",
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: studioName,
    });
  }
  return events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
