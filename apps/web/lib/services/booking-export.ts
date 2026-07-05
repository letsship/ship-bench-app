import type { Repositories } from "@/lib/db/repos/types";
import { type BookingRow, listBookingRows } from "./booking-list";

export interface BookingExportRange {
  from?: string;
  to?: string;
}

// Bookings for the accounting export, filtered by class session start time
// with both ends inclusive. `listBookingRows` already pushes the inclusive
// `from` bound down to the session query; the shared `SessionRange` treats
// `to` as exclusive (the calendar/day views rely on that), so the inclusive
// upper bound is applied here instead of in the shared query.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: BookingExportRange = {},
): Promise<BookingRow[]> {
  const rows = await listBookingRows(repos, studioId, { from: range.from });
  const to = range.to;
  return to ? rows.filter((row) => row.startsAt <= to) : rows;
}
