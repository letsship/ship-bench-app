import type { Repositories, SessionRange } from "@/lib/db/repos/types";

export interface BookingRow {
  id: string;
  memberName: string;
  memberEmail: string;
  className: string;
  classColor: string;
  instructor: string;
  startsAt: string;
  status: string;
}

// Flat list of bookings joined (in-memory) to member + session + class type,
// ordered by session start. The /bookings page buckets these by day. The join
// happens here in the service so repositories stay single-entity.
export async function listBookingRows(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId, range);
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
        id: booking.id,
        memberName: member?.name ?? "—",
        memberEmail: member?.email ?? "",
        className: classType?.name ?? "Class",
        classColor: classType?.color ?? "#6b7280",
        instructor: session?.instructor ?? "",
        startsAt: session?.startsAt ?? "",
        status: booking.status,
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// Bookings flattened for the accounting CSV export. Unlike the /bookings page
// view we do NOT delegate the range to the repository: the repo's SessionRange
// filter is half-open [from, to), but the export spec requires an inclusive
// [from, to] on both bounds. So we load the flat rows and filter them here by
// epoch comparison, leaving an omitted bound unbounded on that side.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: { from?: string; to?: string } = {},
): Promise<BookingRow[]> {
  const rows = await listBookingRows(repos, studioId);
  const fromMs = range.from ? Date.parse(range.from) : undefined;
  const toMs = range.to ? Date.parse(range.to) : undefined;
  return rows.filter((row) => {
    if (!row.startsAt) return false;
    const ms = Date.parse(row.startsAt);
    if (Number.isNaN(ms)) return false;
    if (fromMs !== undefined && !Number.isNaN(fromMs) && ms < fromMs) return false;
    if (toMs !== undefined && !Number.isNaN(toMs) && ms > toMs) return false;
    return true;
  });
}
