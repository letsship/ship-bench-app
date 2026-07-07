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

function parseMs(value: string): number {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

// Export-oriented booking list with inclusive date range filtering.
// Deliberately does NOT reuse `classSessions.listByStudio(studioId, range)`
// because that repo method uses an exclusive `to` bound (correct for its other
// callers — dashboard, class calendar, and listBookingRows itself — which all
// use half-open ranges). This function fetches all sessions and applies its own
// INCLUSIVE-both-ends filter on session start time, so a booking whose session
// starts exactly at the requested `to` instant is NOT silently dropped.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: { from?: string; to?: string } = {},
): Promise<BookingExportRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId);
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));

  // Apply inclusive range filter in application code using numeric timestamps
  // so equivalent instants in different ISO representations (e.g.
  // "2026-06-01T10:00:00Z" vs "2026-06-01T10:00:00.000Z") still compare correctly.
  const fromMs = range.from !== undefined ? Date.parse(range.from) : undefined;
  const toMs = range.to !== undefined ? Date.parse(range.to) : undefined;
  let filteredSessions = sessions;
  if (fromMs !== undefined && !Number.isNaN(fromMs)) {
    filteredSessions = filteredSessions.filter((s) => parseMs(s.startsAt) >= fromMs);
  }
  if (toMs !== undefined && !Number.isNaN(toMs)) {
    filteredSessions = filteredSessions.filter((s) => parseMs(s.startsAt) <= toMs);
  }
  const sessionIds = new Set(filteredSessions.map((s) => s.id));

  return bookings
    .filter((booking) => sessionIds.has(booking.sessionId))
    .map((booking) => {
      const session = sessions.find((s) => s.id === booking.sessionId);
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