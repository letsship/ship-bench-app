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

// Booking rows restricted to a closed `[from, to]` interval on the session
// start, inclusive of both ends. Both bounds are compared as INSTANTS
// (`Date.parse`), never as text: ISO-8601 allows several spellings of the same
// instant (e.g. `2026-06-30T16:00:00-02:00` == `2026-06-30T18:00:00Z`) whose
// lexicographic order is not their time order, so a string compare would
// silently drop or admit the wrong rows. The repo layer's `SessionRange.to` is
// also EXCLUSIVE and `fakes.ts` compares `from` as text, so the whole closed
// interval is applied here in memory against an UNBOUNDED fetch — leaving the
// /bookings page and /api/classes semantics untouched. Fine at studio scale.
export async function listBookingExportRows(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingRow[]> {
  const rows = await listBookingRows(repos, studioId, {});
  const fromMs = range.from ? Date.parse(range.from) : NaN;
  const toMs = range.to ? Date.parse(range.to) : NaN;
  return rows.filter((row) => {
    if (!row.startsAt) return false;
    const startsMs = Date.parse(row.startsAt);
    if (Number.isNaN(startsMs)) return false;
    if (!Number.isNaN(fromMs) && startsMs < fromMs) return false;
    if (!Number.isNaN(toMs) && startsMs > toMs) return false;
    return true;
  });
}
