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

  return rows
    .filter((row) => {
      if (range.from && row.startsAt < range.from) return false;
      if (range.to && row.startsAt > range.to) return false;
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
