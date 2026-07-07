import type { Repositories, SessionRange } from "@/lib/db/repos/types";
import type { ClassSession } from "@/lib/db/types";

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

async function joinBookingRows(
  repos: Repositories,
  studioId: string,
  sessions: ClassSession[],
): Promise<BookingRow[]> {
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

// Flat list of bookings joined (in-memory) to member + session + class type,
// ordered by session start. The /bookings page buckets these by day. The join
// happens here in the service so repositories stay single-entity.
export async function listBookingRows(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId, range);
  return joinBookingRows(repos, studioId, sessions);
}

export async function listBookingRowsForExport(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingRow[]> {
  // The underlying repo treats `to` as exclusive; the export needs inclusive.
  // Pass only `from` to the repo and apply the inclusive `to` filter in memory.
  const sessions = await repos.classSessions.listByStudio(studioId, { from: range.from });
  const to = range.to;
  const filtered = to ? sessions.filter((s) => s.startsAt <= to) : sessions;
  return joinBookingRows(repos, studioId, filtered);
}
