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

const distinct = (ids: string[]): string[] => [...new Set(ids)];

// Flat list of bookings joined (in-memory) to member + session + class type,
// ordered by session start. The /bookings page buckets these by day. The join
// happens here in the service so repositories stay single-entity.
//
// Every related entity is loaded in ONE batch read keyed by the ids the fetched
// bookings actually reference, so the repository read count stays fixed no
// matter how many bookings the range contains (no per-row `getById` fan-out).
export async function listBookingRows(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId, range);
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));

  const [members, bookedSessions] = await Promise.all([
    repos.members.findByIds(distinct(bookings.map((booking) => booking.memberId))),
    repos.classSessions.findByIds(distinct(bookings.map((booking) => booking.sessionId))),
  ]);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const sessionById = new Map(bookedSessions.map((session) => [session.id, session]));

  const rows = bookings.map((booking): BookingRow => {
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
  });
  return rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
