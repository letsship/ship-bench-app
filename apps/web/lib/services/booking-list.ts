import type { Repositories, SessionRange } from "@/lib/db/repos/types";

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

  // Apply inclusive range filter in application code.
  let filteredSessions = sessions;
  if (range.from !== undefined) {
    filteredSessions = filteredSessions.filter((s) => s.startsAt >= range.from!);
  }
  if (range.to !== undefined) {
    filteredSessions = filteredSessions.filter((s) => s.startsAt <= range.to!);
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