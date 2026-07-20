import type { Repositories, SessionRange } from "@/lib/db/repos/types";

export interface BookingExportRow {
  startsAt: string;
  className: string;
  memberName: string;
  memberEmail: string;
  status: string;
}

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
  return rows
    .filter((row) => {
      if (options.from && row.startsAt < options.from) return false;
      if (options.to && row.startsAt > options.to) return false;
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
