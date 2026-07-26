import type { BookingExportRow } from "@/lib/domain/csv";
import type { Repositories } from "@/lib/db/repos/types";
import { listBookingRows } from "@/lib/services/booking-list";

export interface BookingExportRange {
  from?: string;
  to?: string;
}

// Inclusive [from, to] over the session start, unlike the repository's
// SessionRange (which treats `to` as exclusive) — filtered here so a booking
// starting exactly on `to` is still included, per the export's contract.
//
// Bounds are compared as actual instants (via Date.parse), not as raw
// strings: D1 stores startsAt in offset form ("...+00:00") while callers may
// pass "Z"-suffixed bounds, so a string compare never treats an
// exact-boundary match as equal.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: BookingExportRange = {},
): Promise<BookingExportRow[]> {
  const fromMs = range.from ? Date.parse(range.from) : undefined;
  const toMs = range.to ? Date.parse(range.to) : undefined;
  const rows = await listBookingRows(repos, studioId);
  return rows
    .filter((row) => {
      const startMs = Date.parse(row.startsAt);
      return (fromMs === undefined || startMs >= fromMs) && (toMs === undefined || startMs <= toMs);
    })
    .map((row) => ({
      startsAt: row.startsAt,
      className: row.className,
      memberName: row.memberName,
      memberEmail: row.memberEmail,
      status: row.status,
    }));
}
