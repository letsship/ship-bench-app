import type { Repositories } from "@/lib/db/repos/types";
import type { Member } from "@/lib/db/types";
import type { CalendarEvent } from "@/lib/domain/ical";
import { HttpError } from "@/lib/http";

// A member's private calendar feed: the iCalendar events for ONLY that
// token-holder's upcoming, confirmed-seat sessions. The token in the URL is the
// authorization (calendar clients can't send cookies), so an empty or unknown
// token must 404 rather than leak anyone's schedule.

export interface MemberCalendar {
  member: Member;
  events: CalendarEvent[];
}

// Only a `booked` booking represents a confirmed seat the member holds.
// Waitlisted and cancelled bookings are excluded from the member's feed.
const CONFIRMED_BOOKING_STATUS = "booked";

function isUpcoming(startsAt: string, now: Date): boolean {
  return new Date(startsAt).getTime() > now.getTime();
}

export async function getMemberCalendar(
  repos: Repositories,
  token: string,
  now: Date = new Date(),
): Promise<MemberCalendar> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new HttpError(404, "not_found", "Calendar not found");
  }

  const member = await repos.members.findByCalendarToken(trimmed);
  if (!member) {
    throw new HttpError(404, "not_found", "Calendar not found");
  }

  const bookings = await repos.bookings.listByMember(member.id);
  const confirmed = bookings.filter((booking) => booking.status === CONFIRMED_BOOKING_STATUS);

  const sessions = await Promise.all(
    confirmed.map((booking) => repos.classSessions.getById(booking.sessionId)),
  );

  const events: CalendarEvent[] = [];
  await Promise.all(
    confirmed.map(async (booking, index) => {
      const session = sessions[index];
      if (!session) return;
      if (!isUpcoming(session.startsAt, now)) return;
      const classType = await repos.classTypes.getById(session.classTypeId);
      events.push({
        uid: `${session.id}@studiobook`,
        title: classType?.name ?? "Class",
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        description: `Instructor: ${session.instructor}`,
      });
    }),
  );

  // Sort by start time so the feed is stable and readable.
  events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return { member, events };
}
