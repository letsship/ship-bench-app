import type { Repositories, SessionRange } from "@/lib/db/repos/types";

export interface BookingRow {
  id: string;
  memberName: string;
  email: string;
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
        email: member?.email ?? "",
        className: classType?.name ?? "Class",
        classColor: classType?.color ?? "#6b7280",
        instructor: session?.instructor ?? "",
        startsAt: session?.startsAt ?? "",
        status: booking.status,
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// Bookings CSV export for accounting: the repo-level SessionRange treats `to`
// as exclusive (relied on by calendar/day-view queries), but this export
// needs an inclusive upper bound, so it's filtered here in application code
// instead of passed through to the repo layer.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingRow[]> {
  const rows = await listBookingRows(repos, studioId, { from: range.from });
  return range.to === undefined ? rows : rows.filter((row) => row.startsAt <= range.to!);
}
