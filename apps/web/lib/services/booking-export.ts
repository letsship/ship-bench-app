import type { Repositories } from "@/lib/db/repos/types";

export interface BookingExportRow {
  startsAt: string;
  className: string;
  memberName: string;
  memberEmail: string;
  status: string;
}

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
  const allSessions = await repos.classSessions.listByStudio(studioId);
  const sessions = allSessions.filter((session) => {
    if (range.from && session.startsAt < range.from) return false;
    if (range.to && session.startsAt > range.to) return false;
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
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
