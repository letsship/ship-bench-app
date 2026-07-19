import type { Repositories } from "@/lib/db/repos/types";
import { listBookingRows } from "./booking-list";

export interface BookingExportRow {
  startsAt: string;
  className: string;
  memberName: string;
  email: string;
  status: string;
}

export async function listBookingExportRows(
  repos: Repositories,
  studioId: string,
  range: { from?: string; to?: string } = {},
): Promise<BookingExportRow[]> {
  // Fetch all bookings unbounded; filter in-memory to enforce inclusive [from, to]
  const rows = await listBookingRows(repos, studioId);

  // Parse bounds to numeric timestamps for robust comparison across ISO-8601 format variants
  const fromMs = range.from ? Date.parse(range.from) : null;
  const toMs = range.to ? Date.parse(range.to) : null;

  return rows
    .filter((row) => {
      const rowMs = Date.parse(row.startsAt);
      if (fromMs !== null && rowMs < fromMs) return false;
      if (toMs !== null && rowMs > toMs) return false;
      return true;
    })
    .map((row) => ({
      startsAt: row.startsAt,
      className: row.className,
      memberName: row.memberName,
      email: row.email,
      status: row.status,
    }));
}
