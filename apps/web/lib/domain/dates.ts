// Timezone-safe date helpers. Studiobook stores every instant as a UTC ISO
// string; day/month bucketing (schedules, reports) must happen in the studio's
// IANA timezone, never by slicing the ISO string. These pure helpers are the
// single source of that conversion.

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function toDate(iso: string): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid ISO timestamp: ${iso}`);
  return date;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");
const pad4 = (n: number): string => String(n).padStart(4, "0");

// Wall-clock parts of an instant as observed in `timeZone`.
export function zonedParts(iso: string, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(toDate(iso));
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

// "YYYY-MM-DD" for the calendar day the instant falls on in `timeZone`.
export function dayKey(iso: string, timeZone: string): string {
  const parts = zonedParts(iso, timeZone);
  return `${pad4(parts.year)}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

// "YYYY-MM" for the calendar month the instant falls on in `timeZone`.
export function monthKey(iso: string, timeZone: string): string {
  const parts = zonedParts(iso, timeZone);
  return `${pad4(parts.year)}-${pad2(parts.month)}`;
}

export function isSameDay(a: string, b: string, timeZone: string): boolean {
  return dayKey(a, timeZone) === dayKey(b, timeZone);
}

// Signed hours from `fromIso` to `toIso` (negative if `toIso` is in the past).
export function hoursBetween(fromIso: string, toIso: string): number {
  return (toDate(toIso).getTime() - toDate(fromIso).getTime()) / 3_600_000;
}

// Whole minutes between two instants, rounded to the nearest minute.
export function durationMinutes(startIso: string, endIso: string): number {
  return Math.round((toDate(endIso).getTime() - toDate(startIso).getTime()) / 60_000);
}

export function isBefore(a: string, b: string): boolean {
  return toDate(a).getTime() < toDate(b).getTime();
}

// True when `iso` falls within [from, to] inclusive of both bounds. An omitted
// bound is unbounded on that side. Parses each value to an instant before
// comparing, so any valid ISO-8601 form works as a bound — a bare date like
// `2026-06-30`, a timestamp missing milliseconds like `2026-06-30T23:59:59Z`,
// or an offset timestamp like `2026-06-01T00:00:00+02:00` — without the
// lexicographic-ordering pitfalls of comparing raw strings of differing
// formats. Unlike the exclusive-on-`to` `SessionRange` used by calendar views,
// this is the inclusive semantics accounting exports need.
export function isWithinInclusiveRange(
  iso: string,
  from?: string,
  to?: string,
): boolean {
  const t = toDate(iso).getTime();
  if (from && t < toDate(from).getTime()) return false;
  if (to && t > toDate(to).getTime()) return false;
  return true;
}

// Group items by their calendar day (in `timeZone`), preserving input order
// within each day. Returns days sorted ascending.
export function groupByDay<T>(
  items: readonly T[],
  getIso: (item: T) => string,
  timeZone: string,
): { day: string; items: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKey(getIso(item), timeZone);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayItems]) => ({ day, items: dayItems }));
}
