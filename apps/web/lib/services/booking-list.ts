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
// happens here in the service so repositories stay single-entity.
export async function listBookingRows(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId, range);
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));

  // Batch the member + class-session joins: a single bounded read per repo,
  // independent of how many bookings we return (the old N+1 read one per row).
  const memberIds = [...new Set(bookings.map((booking) => booking.memberId))];
  const sessionIds = [...new Set(bookings.map((booking) => booking.sessionId))];
  const [members, referencedSessions] = await Promise.all([
    repos.members.listByIds(memberIds),
    repos.classSessions.listByIds(sessionIds),
  ]);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const sessionById = new Map(referencedSessions.map((session) => [session.id, session]));

  const rows: BookingRow[] = [];
  for (const booking of bookings) {
    const session = sessionById.get(booking.sessionId);
    const classType = session ? typeById.get(session.classTypeId) : undefined;
    const member = memberById.get(booking.memberId);
    rows.push({
      id: booking.id,
      memberName: member?.name ?? "—",
      className: classType?.name ?? "Class",
      classColor: classType?.color ?? "#6b7280",
      instructor: session?.instructor ?? "",
      startsAt: session?.startsAt ?? "",
      status: booking.status,
    });
  }
  return rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
