import type { Repositories } from "@/lib/db/repos/types";

export interface BookingExportRow {
  startsAt: string;
  className: string;
  memberName: string;
  email: string;
  status: string;
}

export interface BookingExportRange {
  from?: string;
  to?: string;
}

function withinRange(startsAt: string, range: BookingExportRange): boolean {
  const startsMs = Date.parse(startsAt);
  if (range.from && !(startsMs >= Date.parse(range.from))) return false;
  if (range.to && !(startsMs <= Date.parse(range.to))) return false;
  return true;
}

// Bookings joined (in-memory) to member (name + email), session start, and
// class type name, for the accounting CSV export. The date window is applied
// here, inclusively on both ends, rather than through the repository
// SessionRange filter — that one is half-open [from, to) and would drop a
// booking whose session starts exactly at `to`.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: BookingExportRange = {},
): Promise<BookingExportRow[]> {
  const sessions = (await repos.classSessions.listByStudio(studioId)).filter((session) =>
    withinRange(session.startsAt, range),
  );
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
        email: member?.email ?? "",
        status: booking.status,
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
