import type { Repositories, SessionRange } from "@/lib/db/repos/types";

export interface BookingExportRow {
  startsAt: string;
  className: string;
  memberName: string;
  email: string;
  status: string;
}

export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingExportRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId, {
    from: range.from,
  });

  const filtered = sessions.filter((session) => {
    if (range.to && session.startsAt > range.to) return false;
    return true;
  });

  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((t) => [t.id, t]));
  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const bookings = await repos.bookings.listBySessionIds(
    filtered.map((s) => s.id),
  );

  return bookings
    .map((booking) => {
      const session = filtered.find((s) => s.id === booking.sessionId);
      if (!session) return null;
      const classType = typeById.get(session.classTypeId);
      const member = memberById.get(booking.memberId);
      return {
        startsAt: session.startsAt,
        className: classType?.name ?? "Class",
        memberName: member?.name ?? "—",
        email: member?.email ?? "",
        status: booking.status,
      };
    })
    .filter((row): row is BookingExportRow => row !== null)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}