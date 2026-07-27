import type { BookingExportRow } from "@/lib/domain/csv";
import type { Repositories } from "@/lib/db/repos/types";

export interface BookingsExportRange {
  from?: string;
  to?: string;
}

// Flat, exportable list of bookings joined (in-memory) to session, class type,
// and member, filtered by session start time. Fetches sessions unfiltered and
// applies its own INCLUSIVE [from, to] bounds rather than delegating to the
// repo SessionRange filter, which treats `to` as exclusive — the export needs
// both ends inclusive.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: BookingsExportRange = {},
): Promise<BookingExportRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId);
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));

  const fromMs = range.from ? Date.parse(range.from) : undefined;
  const toMs = range.to ? Date.parse(range.to) : undefined;

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
    .filter((row) => (fromMs === undefined ? true : Date.parse(row.startsAt) >= fromMs))
    .filter((row) => (toMs === undefined ? true : Date.parse(row.startsAt) <= toMs))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}
