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

export interface BookingExportRange {
  from?: string;
  to?: string;
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

// Flat list of bookings for the CSV export, joined to session + class type +
// member (with email) and ordered by session start. Unlike listBookingRows, the
// date range here is inclusive on BOTH ends — the bookkeeper asks for "1 June to
// 30 June" and expects sessions starting exactly on 30 June to be included. We
// therefore fetch every session (no repo-level SessionRange, whose `to` is
// exclusive by contract — see fakes.test.ts) and filter in-memory.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: BookingExportRange = {},
): Promise<BookingExportRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId);
  // Compare instants via Date.parse() rather than raw string comparison. The
  // session start and the caller-supplied bound may be the same instant written
  // with different ISO-8601 suffixes (e.g. "...+00:00" vs "...Z", or a
  // date-only "2026-06-30" vs "2026-06-30T08:00:00Z"), which would sort
  // differently as strings and silently drop an exact-boundary match. Parsing
  // to epoch milliseconds makes the inclusive-both-ends filter correct
  // regardless of the precision or offset notation the caller supplies.
  const fromMs = range.from === undefined ? undefined : Date.parse(range.from);
  const toMs = range.to === undefined ? undefined : Date.parse(range.to);
  const inRange = sessions.filter((session) => {
    const startsMs = Date.parse(session.startsAt);
    return (
      (fromMs === undefined || startsMs >= fromMs) &&
      (toMs === undefined || startsMs <= toMs)
    );
  });
  const sessionById = new Map(inRange.map((session) => [session.id, session]));
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookings = await repos.bookings.listBySessionIds(
    inRange.map((session) => session.id),
  );

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
