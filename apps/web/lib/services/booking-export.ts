import type { Repositories, SessionRange } from "@/lib/db/repos/types";
import type { BookingExportRow } from "@/lib/domain/csv";

// Flat bookings export joined (in-memory) to member + session + class type,
// ordered by session start. Unlike listBookingRows, this carries the member
// email (the bookkeeper needs it) and filters the date range INCLUSIVELY on
// both ends — the repository SessionRange upper bound is exclusive, so the
// range is applied here rather than delegated to the repo.
export async function listBookingExportRows(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingExportRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId);
  const visible = sessions.filter((session) => withinInclusive(session.startsAt, range));
  const sessionById = new Map(visible.map((session) => [session.id, session]));
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookings = await repos.bookings.listBySessionIds(visible.map((session) => session.id));

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

function withinInclusive(startsAt: string, range: SessionRange): boolean {
  if (range.from && startsAt < range.from) return false;
  if (range.to && startsAt > range.to) return false;
  return true;
}
