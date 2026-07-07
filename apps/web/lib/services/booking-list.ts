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
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// Parse an ISO-8601 timestamp to epoch milliseconds. Both the stored
// `session.startsAt` and the client-supplied `from`/`to` query strings are
// ISO-8601, but they may differ in textual shape (e.g. the Supabase layer
// returns `2026-06-27T08:00:00+00:00` while a browser's `Date.toISOString()`
// produces `2026-06-27T08:00:00.000Z`). Comparing them as raw strings would
// sort `+00:00` before `.000Z` (ASCII '+' 0x2B < '.' 0x2E) and silently drop a
// session that starts exactly at a bound. Parsing to epoch ms makes the
// comparison format-independent.
function toEpochMs(value: string): number {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? Number.NaN : ms;
}

// Same join as `listBookingRows`, but for the quarterly CSV export the founder
// hands to the bookkeeper: it additionally pulls the member's email and columns
// in the export order, and it filters by session start time on an INCLUSIVE
// `[from, to]` range. The repo's `listByStudio` range parameter is `[from, to)`
// (exclusive upper bound, since the bookings page buckets by day) — reusing it
// for `to` would silently drop a session that starts exactly at `to`. So we
// fetch sessions unbounded here and apply the inclusive comparison locally,
// comparing on epoch milliseconds (not raw strings) so the bound is robust to
// differing ISO-8601 textual shapes between the DB and the client.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingExportRow[]> {
  const fromMs = range.from ? toEpochMs(range.from) : undefined;
  const toMs = range.to ? toEpochMs(range.to) : undefined;
  const sessions = await repos.classSessions.listByStudio(studioId, {});
  const included = sessions.filter((session) => {
    const startsMs = toEpochMs(session.startsAt);
    if (Number.isNaN(startsMs)) return false;
    if (fromMs !== undefined && !Number.isNaN(fromMs) && startsMs < fromMs) return false;
    if (toMs !== undefined && !Number.isNaN(toMs) && startsMs > toMs) return false;
    return true;
  });
  const sessionById = new Map(included.map((session) => [session.id, session]));
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookings = await repos.bookings.listBySessionIds(included.map((session) => session.id));

  return bookings
    .map((booking) => {
      const session = sessionById.get(booking.sessionId);
      const classType = session ? typeById.get(session.classTypeId) : undefined;
      const member = memberById.get(booking.memberId);
      return {
        startsAt: session?.startsAt ?? "",
        className: classType?.name ?? "Class",
        memberName: member?.name ?? "—",
        email: member?.email ?? "",
        status: booking.status,
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
