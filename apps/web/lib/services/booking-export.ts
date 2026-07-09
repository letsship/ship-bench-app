import { HttpError } from "@/lib/http";
import type { BookingExportRow } from "@/lib/domain/csv";
import type { Repositories, SessionRange } from "@/lib/db/repos/types";

// Matches a full ISO-8601 date-time with an explicit `Z` or `+HH:MM`/`-HH:MM`
// (colon optional) offset. Used instead of `new Date(string)` for `from`/`to`
// bounds: the native string parser's support for the offset form isn't
// consistent across JS engines (e.g. Node vs the Workers runtime), and an
// unparseable string silently produces `NaN`, which compares `false` against
// everything and disables filtering instead of raising an error.
const ISO_8601_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:?\d{2})$/;

function parseIsoTimestampMs(value: string): number | undefined {
  const match = ISO_8601_RE.exec(value.trim());
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second, fraction, offset] = match;
  const ms = fraction ? Number(fraction.slice(0, 3).padEnd(3, "0")) : 0;
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    ms,
  );
  if (offset === "Z") return utcMs;
  const sign = offset[0] === "+" ? 1 : -1;
  const digits = offset.slice(1).replace(":", "");
  const offsetMs = (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4))) * 60_000;
  return utcMs - sign * offsetMs;
}

function parseBound(value: string | undefined, label: "from" | "to"): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseIsoTimestampMs(value);
  if (parsed === undefined) {
    throw new HttpError(400, "bad_request", `Invalid ISO-8601 timestamp for "${label}"`);
  }
  return parsed;
}

// Bookings joined (in-memory) to session + class type + member for the CSV
// export. Sessions are fetched unbounded and filtered here with an inclusive
// [from, to] comparison, since the shared `SessionRange` repo filter used by
// /api/bookings is exclusive on `to` and would drop a session starting
// exactly at the requested end of the range.
export async function listBookingsForExport(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingExportRow[]> {
  const fromMs = parseBound(range.from, "from");
  const toMs = parseBound(range.to, "to");
  const sessions = await repos.classSessions.listByStudio(studioId);
  const inRange = sessions.filter((session) => {
    const startMs = parseIsoTimestampMs(session.startsAt) ?? Number.NaN;
    if (fromMs !== undefined && startMs < fromMs) return false;
    if (toMs !== undefined && startMs > toMs) return false;
    return true;
  });
  const sessionById = new Map(inRange.map((session) => [session.id, session]));
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookings = await repos.bookings.listBySessionIds(inRange.map((session) => session.id));

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
