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

// The accounting export window, INCLUSIVE on both ends — unlike the repo-level
// `SessionRange`, which is half-open ([from, to)). A bookkeeper asking for
// "1 June to 30 June" expects a class starting exactly at `to` to be in there.
export interface BookingExportRange {
  from?: string;
  to?: string;
}

// Bounds are compared as instants, not strings, so a caller-supplied
// "2026-06-01T00:00:00Z" still matches a stored "2026-06-01T00:00:00.000Z".
// An omitted (or unparseable) bound leaves that side unbounded.
function withinInclusive(startsAt: string, range: BookingExportRange): boolean {
  const at = Date.parse(startsAt);
  const from = range.from ? Date.parse(range.from) : Number.NaN;
  const to = range.to ? Date.parse(range.to) : Number.NaN;
  if (!Number.isNaN(from) && at < from) return false;
  if (!Number.isNaN(to) && at > to) return false;
  return true;
}

// Bookings in the window, joined to session + class type + member (name and
// email), ordered by session start — the shape the CSV export hands over. The
// range filter is applied here rather than by `classSessions.listByStudio`
// because that filter excludes the `to` bound.
export async function listBookingExportRows(
  repos: Repositories,
  studioId: string,
  range: BookingExportRange = {},
): Promise<BookingExportRow[]> {
  const sessions = (await repos.classSessions.listByStudio(studioId)).filter((session) =>
    withinInclusive(session.startsAt, range),
  );
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
        startsAt: session?.startsAt ?? "",
        className: classType?.name ?? "Class",
        memberName: member?.name ?? "—",
        email: member?.email ?? "",
        status: booking.status,
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
