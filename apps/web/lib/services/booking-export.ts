import type { BookingExportRow } from "@/lib/domain/csv";
import type { Repositories, SessionRange } from "@/lib/db/repos/types";

// Bookings joined (in-memory) to session + class type + member for the CSV
// export. Sessions are fetched unbounded and filtered here with an inclusive
// [from, to] comparison, since the shared `SessionRange` repo filter used by
// /api/bookings is exclusive on `to` and would drop a session starting
// exactly at the requested end of the range. Bounds are compared as parsed
// timestamps (not raw strings) because `from`/`to` arrive as query params and
// may use a different ISO-8601 representation (e.g. `+00:00` offset) than the
// stored `startsAt` (e.g. `.000Z`) — lexicographic string comparison would
// misorder those even when they denote the same instant.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingExportRow[]> {
  const fromMs = range.from ? new Date(range.from).getTime() : undefined;
  const toMs = range.to ? new Date(range.to).getTime() : undefined;
  const sessions = await repos.classSessions.listByStudio(studioId);
  const inRange = sessions.filter((session) => {
    const startMs = new Date(session.startsAt).getTime();
    if (fromMs !== undefined && startMs < fromMs) return false;
    if (toMs !== undefined && startMs > toMs) return false;
    return true;
  });
  const sessionById = new Map(inRange.map((session) => [session.id, session]));
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookings = await repos.bookings.listBySessionIds(inRange.map((session) => session.id));

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
