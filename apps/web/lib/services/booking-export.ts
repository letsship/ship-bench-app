import type { BookingExportRow } from "@/lib/domain/csv";
import type { Repositories } from "@/lib/db/repos/types";

export type { BookingExportRow };

export interface BookingExportRange {
  from?: string;
  to?: string;
}

// Flat list of bookings joined (in-memory) to member + session + class type,
// for the accounting CSV export. Mirrors the join in booking-list.ts but also
// projects member email. Filters on session startsAt with BOTH ends inclusive
// — unlike the shared SessionRange/inRange filtering used by /api/bookings and
// /api/classes, which excludes `to` — so this filters explicitly here instead
// of delegating to classSessions.listByStudio's range argument.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: BookingExportRange = {},
): Promise<BookingExportRow[]> {
  const from = range.from ? new Date(range.from).getTime() : undefined;
  const to = range.to ? new Date(range.to).getTime() : undefined;
  const allSessions = await repos.classSessions.listByStudio(studioId);
  const sessions = allSessions.filter((session) => {
    const startsAt = new Date(session.startsAt).getTime();
    if (from !== undefined && startsAt < from) return false;
    if (to !== undefined && startsAt > to) return false;
    return true;
  });
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));

  return bookings
    .map((booking) => {
      const session = sessionById.get(booking.sessionId);
      const classType = session ? typeById.get(session.classTypeId) : undefined;
      const member = memberById.get(booking.memberId);
      return {
        startsAt: session?.startsAt ?? "",
        className: classType?.name ?? "Class",
        memberName: member?.name ?? "—",
        memberEmail: member?.email ?? "",
        status: booking.status,
      };
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}
