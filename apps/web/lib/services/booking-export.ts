import type { Repositories } from "@/lib/db/repos/types";
import { type BookingRow, listBookingRows } from "./booking-list";

export interface BookingExportRange {
  from?: string;
  to?: string;
}

// Bounds may arrive as any valid ISO-8601 timestamp (non-UTC offset, no
// milliseconds, etc). Stored session starts are always UTC instants, so raw
// string comparison against a differently-formatted bound is wrong (e.g.
// "+00:00" sorts after "."). Normalizing to a UTC instant string first makes
// the comparison correct regardless of the input's original format.
function toUtcInstant(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
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
  const from = toUtcInstant(range.from);
  const to = toUtcInstant(range.to);
  const rows = await listBookingRows(repos, studioId, { from });
  return to ? rows.filter((row) => row.startsAt <= to) : rows;
}
