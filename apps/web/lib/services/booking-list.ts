import type { Repositories, SessionRange } from "@/lib/db/repos/types";
import type { BookingExportRow } from "@/lib/domain/csv";

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

// Export rows for bookings CSV with optional date-range filtering.
// Date bounds are INCLUSIVE on both ends (unlike the repo's exclusive 'to' in SessionRange).
export async function listBookingExportRows(
  repos: Repositories,
  studioId: string,
  options: { from?: string; to?: string } = {},
): Promise<BookingExportRow[]> {
  const rows = await listBookingRows(repos, studioId);
  const fromMs = options.from ? new Date(options.from).getTime() : undefined;
  const toMs = options.to ? new Date(options.to).getTime() : undefined;

  return rows
    .filter((row) => {
      const rowMs = new Date(row.startsAt).getTime();
      if (fromMs !== undefined && rowMs < fromMs) return false;
      if (toMs !== undefined && rowMs > toMs) return false;
      return true;
    })
    .map((row) => ({
      startsAt: row.startsAt,
      className: row.className,
      memberName: row.memberName,
      memberEmail: row.memberEmail,
      status: row.status,
    }));
}
