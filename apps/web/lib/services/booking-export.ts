import type { BookingExportRow } from "@/lib/domain/csv";
import type { Repositories } from "@/lib/db/repos/types";

// Inclusive range for the export. Neither from nor to is required.
export interface BookingExportRange {
  from?: string;
  to?: string;
}

/**
 * Returns export-ready booking rows for a studio within an inclusive [from, to]
 * date range on session start time. Uses the repo's inclusive-from filter but
 * applies the upper bound in-memory because the shared SessionRange.to is
 * exclusive. Omitted bounds are unbounded on that side. Sorted by startsAt.
 */
export async function listBookingExportRows(
  repos: Repositories,
  studioId: string,
  range: BookingExportRange = {},
): Promise<BookingExportRow[]> {
  // Fetch sessions using only the inclusive-from bound (the repo's SessionRange
  // `to` is exclusive, so we cannot pass it directly).
  const sessions = await repos.classSessions.listByStudio(studioId, { from: range.from });

  // Apply the inclusive-upper-bound ourselves.
  const upperBound = range.to;
  const filtered = upperBound
    ? sessions.filter((session) => session.startsAt <= upperBound)
    : sessions;

  const sessionById = new Map(filtered.map((session) => [session.id, session]));
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookings = await repos.bookings.listBySessionIds(
    filtered.map((session) => session.id),
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