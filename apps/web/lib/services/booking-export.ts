import type { Repositories } from "@/lib/db/repos/types";

export interface BookingExportRange {
  from?: string;
  to?: string;
}

export interface BookingExportRow {
  startsAt: string;
  className: string;
  memberName: string;
  memberEmail: string;
  status: string;
}

function isWithinRange(startsAt: string, range: BookingExportRange): boolean {
  return (!range.from || startsAt >= range.from) && (!range.to || startsAt <= range.to);
}

export async function listBookingExportRows(
  repos: Repositories,
  studioId: string,
  range: BookingExportRange = {},
): Promise<BookingExportRow[]> {
  const sessions = await repos.classSessions.listByStudio(
    studioId,
    range.from ? { from: range.from } : {},
  );
  const filteredSessions = sessions.filter((session) => isWithinRange(session.startsAt, range));
  const sessionById = new Map(filteredSessions.map((session) => [session.id, session]));
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookings = await repos.bookings.listBySessionIds(
    filteredSessions.map((session) => session.id),
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
        memberEmail: member?.email ?? "—",
        status: booking.status,
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
