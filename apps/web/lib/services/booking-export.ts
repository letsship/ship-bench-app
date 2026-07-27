import type { Repositories } from "@/lib/db/repos/types";

export interface BookingExportRow {
  startsAt: string;
  className: string;
  memberName: string;
  memberEmail: string;
  status: string;
}

// List of bookings with member email for export, joined (in-memory) to
// session + class type + member. Filters on session start with both ends
// inclusive: from <= startsAt <= to. An omitted bound is unbounded.
// Sorted by session start.
export async function listBookingExportRows(
  repos: Repositories,
  studioId: string,
  range: { from?: string; to?: string } = {},
): Promise<BookingExportRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId);
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));

  // Parse range bounds as Date objects for numeric comparison (handles both
  // 'Z' and '+HH:MM' ISO-8601 forms correctly).
  const fromTime = range.from ? new Date(range.from).getTime() : -Infinity;
  const toTime = range.to ? new Date(range.to).getTime() : Infinity;

  return bookings
    .map((booking) => {
      const session = sessionById.get(booking.sessionId);
      const classType = session ? typeById.get(session.classTypeId) : undefined;
      const member = memberById.get(booking.memberId);
      return {
        startsAt: session?.startsAt ?? "",
        className: classType?.name ?? "Class",
        memberName: member?.name ?? "—",
        memberEmail: member?.email ?? "",
        status: booking.status,
      };
    })
    .filter((row) => {
      if (!row.startsAt) return false;
      const rowTime = new Date(row.startsAt).getTime();
      if (rowTime < fromTime) return false;
      if (rowTime > toTime) return false;
      return true;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
