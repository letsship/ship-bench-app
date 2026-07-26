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
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: BookingExportRange = {},
): Promise<BookingExportRow[]> {
  const rows = await listBookingRows(repos, studioId);
  return rows
    .filter(
      (row) =>
        (!range.from || row.startsAt >= range.from) && (!range.to || row.startsAt <= range.to),
    )
    .map((row) => ({
      startsAt: row.startsAt,
      className: row.className,
      memberName: row.memberName,
      memberEmail: row.memberEmail,
      status: row.status,
    }));
}
