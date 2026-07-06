import type { Repositories } from "@/lib/db/repos/types";
import { listBookingRows } from "@/lib/services/booking-list";

export interface BookingsExportRange {
  from?: string;
  to?: string;
}

// Bookings for the accounting export, filtered to a [from, to] range on the
// class session's start time — inclusive of BOTH ends. This differs from the
// shared `SessionRange` used by `classSessions.listByStudio`, whose `to` bound
// is exclusive (see `inRange` in `apps/web/lib/db/repos/fakes.ts`) to support
// day-boundary calendar filtering elsewhere. Rather than change that shared
// semantics, only `from` (already inclusive) is passed down, and `to` is
// applied here as an explicit inclusive filter.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: BookingsExportRange = {},
) {
  const rows = await listBookingRows(repos, studioId, { from: range.from });
  if (!range.to) return rows;
  return rows.filter((row) => row.startsAt <= range.to!);
}
