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

// Flat list of bookings joined (in-memory) to member + session + class type,
// ordered by session start. The /bookings page buckets these by day. The join
// happens here in the service so repositories stay single-entity. Every side of
// the join is fetched in bulk up front and indexed by id, so the read count is
// fixed (4) no matter how many bookings come back — never per-booking lookups.
export async function listBookingRows(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingRow[]> {
  const [sessions, classTypes, members] = await Promise.all([
    repos.classSessions.listByStudio(studioId, range),
    repos.classTypes.listByStudio(studioId),
    repos.members.listByStudio(studioId),
  ]);
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookings = await repos.bookings.listBySessionIds([...sessionById.keys()]);

  return bookings
    .map((booking): BookingRow => {
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
