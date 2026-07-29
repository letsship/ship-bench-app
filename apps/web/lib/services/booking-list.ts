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

// A bound as epoch ms; an omitted or unparseable bound is unbounded.
function parseBound(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}

// Rows for the accounting CSV export. Unlike listBookingRows, the [from, to]
// range is INCLUSIVE of both ends, so it is applied here on parsed timestamps
// rather than delegated to the repository SessionRange filter (whose `to` is
// exclusive). Comparing epoch ms (not strings) keeps mixed ISO precisions
// correct.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingRow[]> {
  const rows = await listBookingRows(repos, studioId);
  const fromMs = parseBound(range.from);
  const toMs = parseBound(range.to);
  if (fromMs === undefined && toMs === undefined) return rows;
  return rows.filter((row) => {
    const startsMs = Date.parse(row.startsAt);
    if (Number.isNaN(startsMs)) return false;
    if (fromMs !== undefined && startsMs < fromMs) return false;
    if (toMs !== undefined && startsMs > toMs) return false;
    return true;
  });
}
