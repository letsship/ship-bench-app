import type { BookingExportRow } from "@/lib/domain/csv";
import type { Repositories } from "@/lib/db/repos/types";

export interface BookingExportRange {
  from?: string;
  to?: string;
}

// Flat, accounting-friendly join of sessions -> class types -> members ->
// bookings, filtered inclusively on both ends of the session start time.
// The shared SessionRange repo filter is half-open [from, to) (`to` is
// exclusive), so `to` is deliberately NOT passed to the repository — it is
// applied here in memory to keep the export's [from, to] inclusive.
export async function listBookingExportRows(
  repos: Repositories,
  studioId: string,
  range: BookingExportRange = {},
): Promise<BookingExportRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId, { from: range.from });
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));

  const toMs = range.to ? new Date(range.to).getTime() : undefined;

  return bookings
    .map((booking) => {
      const session = sessionById.get(booking.sessionId);
      const classType = session ? typeById.get(session.classTypeId) : undefined;
      const member = memberById.get(booking.memberId);
      return {
        startsAt: session ? new Date(session.startsAt).toISOString() : "",
        className: classType?.name ?? "Class",
        memberName: member?.name ?? "—",
        memberEmail: member?.email ?? "",
        status: booking.status,
      };
    })
    .filter((row) => toMs === undefined || new Date(row.startsAt).getTime() <= toMs)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
