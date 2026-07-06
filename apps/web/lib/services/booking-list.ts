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

// Export-only variant of `listBookingRows`: the shared `SessionRange`
// convention (used by /api/bookings and the bookings page) is
// inclusive-from/exclusive-to, but a CSV export needs inclusive-both-ends
// range semantics. Fetch unbounded above via the repo, then filter the `to`
// bound in-memory so the shared convention stays untouched elsewhere.
export async function listBookingRowsForExport(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingRow[]> {
  const rows = await listBookingRows(repos, studioId, { from: range.from });
  if (!range.to) return rows;
  return rows.filter((row) => row.startsAt <= range.to!);
}
