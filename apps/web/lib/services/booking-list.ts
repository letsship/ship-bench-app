import type { Repositories, SessionRange } from "@/lib/db/repos/types";
import type { BookingExportRow } from "@/lib/domain/csv";

export interface BookingRow {
  id: string;
  memberName: string;
  className: string;
  classColor: string;
  instructor: string;
  startsAt: string;
  status: string;
  email: string;
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
        className: classType?.name ?? "Class",
        classColor: classType?.color ?? "#6b7280",
        instructor: session?.instructor ?? "",
        startsAt: session?.startsAt ?? "",
        status: booking.status,
        email: member?.email ?? "",
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// Bookings export for accounting: every booking whose session starts within
// [from, to], INCLUSIVE of both ends. The bounds are compared with Date.parse
// so differing ISO precision (e.g. millis vs none) cannot drop a boundary row.
// We deliberately do NOT pass `to` through the repository SessionRange: the
// repos' `inRange` helper treats `to` as exclusive (startsAt >= to is dropped),
// which contradicts the inclusive-both-ends criterion the bookkeeper needs.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: { from?: string; to?: string },
): Promise<BookingExportRow[]> {
  const rows = await listBookingRows(repos, studioId);
  const fromMs = range.from ? Date.parse(range.from) : undefined;
  const toMs = range.to ? Date.parse(range.to) : undefined;
  return rows
    .filter((row) => {
      const startsMs = Date.parse(row.startsAt);
      if (Number.isNaN(startsMs)) return false;
      if (fromMs !== undefined && startsMs < fromMs) return false;
      if (toMs !== undefined && startsMs > toMs) return false;
      return true;
    })
    .map((row) => ({
      startsAt: row.startsAt,
      className: row.className,
      memberName: row.memberName,
      email: row.email,
      status: row.status,
    }));
}
