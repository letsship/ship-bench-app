import type { Repositories } from "@/lib/db/repos/types";
import type { BookingExportRow } from "@/lib/domain/csv";

// Bookings export for the quarterly accountant hand-off. Mirrors the join in
// `booking-list.ts` (session -> class type -> member -> booking) but adds the
// member's email (which the /bookings page row doesn't carry) and applies an
// INCLUSIVE-both-ends filter on `startsAt`. The shared `SessionRange`/`inRange`
// helper used by classes/dashboard/booking-list is exclusive on `to` (calendar-
// style: a session starting exactly at `to` is dropped); reusing it here would
// silently drop a booking whose session starts at the exact `to` the
// bookkeeper picked, so this service does its own comparison instead. Rows are
// sorted by session start ascending, matching `listBookingRows`.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: { from?: string; to?: string } = {},
): Promise<BookingExportRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId);
  const filtered = sessions.filter((session) => {
    if (range.from && session.startsAt < range.from) return false;
    if (range.to && session.startsAt > range.to) return false;
    return true;
  });
  const sessionById = new Map(filtered.map((session) => [session.id, session]));
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookings = await repos.bookings.listBySessionIds(
    filtered.map((session) => session.id),
  );

  return bookings
    .map((booking) => {
      const session = sessionById.get(booking.sessionId);
      const classType = session ? typeById.get(session.classTypeId) : undefined;
      const member = memberById.get(booking.memberId);
      return {
        startsAt: session?.startsAt ?? "",
        className: classType?.name ?? "Class",
        memberName: member?.name ?? "—",
        email: member?.email ?? "",
        status: booking.status,
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
