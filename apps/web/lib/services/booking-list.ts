import type { Repositories, SessionRange } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";

export interface BookingRow {
  id: string;
  memberName: string;
  className: string;
  classColor: string;
  instructor: string;
  startsAt: string;
  status: string;
}

export interface BookingExportRow {
  startsAt: string;
  className: string;
  memberName: string;
  email: string;
  status: string;
}

interface JoinedBookingRow {
  id: string;
  memberName: string;
  email: string;
  className: string;
  classColor: string;
  instructor: string;
  startsAt: string;
  status: string;
}

// Joins bookings (in-memory) to member + session + class type, ordered by
// session start. Shared by the bookings-page listing and the CSV export so
// the join logic lives in one place.
function joinBookingRows(
  sessions: ClassSession[],
  classTypes: ClassType[],
  members: Member[],
  bookings: Booking[],
): JoinedBookingRow[] {
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const memberById = new Map(members.map((member) => [member.id, member]));

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
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const members = await repos.members.listByStudio(studioId);
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));

  return joinBookingRows(sessions, classTypes, members, bookings);
}

// Bookings export for accounting: unlike `SessionRange` elsewhere (inclusive
// `from`, exclusive `to`), this range is inclusive on both ends, so `to` is
// filtered in-memory after the join instead of being passed to the repo.
export async function listBookingRowsForExport(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingExportRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId, { from: range.from });
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const members = await repos.members.listByStudio(studioId);
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));

  const toMs = range.to ? new Date(range.to).getTime() : undefined;

  return joinBookingRows(sessions, classTypes, members, bookings)
    .filter((row) => toMs === undefined || new Date(row.startsAt).getTime() <= toMs)
    .map((row) => ({
      startsAt: row.startsAt,
      className: row.className,
      memberName: row.memberName,
      email: row.email,
      status: row.status,
    }));
}
