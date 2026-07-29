import type { Repositories, SessionRange } from "@/lib/db/repos/types";
import type { BookingExportRow } from "@/lib/domain/csv";

// Flat bookings export joined (in-memory) to member + session + class type,
// ordered by session start. Unlike listBookingRows, this carries the member
// email (the bookkeeper needs it) and filters the date range INCLUSIVELY on
// both ends — the repository SessionRange upper bound is exclusive, so the
// range is applied here rather than delegated to the repo.
//
// Timestamps are compared by epoch millisecond, NOT by raw string compare:
// Supabase emits `startsAt` as `2026-06-25T08:00:00+00:00` (offset form) while
// callers pass `from`/`to` as canonical `...Z` ISO-8601, and lexically `+` <
// `Z`, which would drop an exact-boundary session. `URLSearchParams` also
// decodes `+` to a space, so a `+00:01` offset would arrive corrupted; we
// restore it before parsing.
export async function listBookingExportRows(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingExportRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId);
  const visible = sessions.filter((session) => withinInclusive(session.startsAt, range));
  const sessionById = new Map(visible.map((session) => [session.id, session]));
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const members = await repos.members.listByStudio(studioId);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const bookings = await repos.bookings.listBySessionIds(visible.map((session) => session.id));

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
    .sort((a, b) => (epochMs(a.startsAt) ?? 0) - (epochMs(b.startsAt) ?? 0));
}

function withinInclusive(startsAt: string, range: SessionRange): boolean {
  const startMs = epochMs(startsAt);
  if (startMs === null) return true;
  if (range.from) {
    const fromMs = epochMs(range.from);
    if (fromMs !== null && startMs < fromMs) return false;
  }
  if (range.to) {
    const toMs = epochMs(range.to);
    if (toMs !== null && startMs > toMs) return false;
  }
  return true;
}

// Parse an ISO-8601 timestamp to epoch milliseconds, tolerating the `+` offset
// corruption that `URLSearchParams` introduces (it decodes `+` to a space).
// Returns `null` for unparseable input so a bad bound is treated as unbounded
// rather than dropping every row.
function epochMs(iso: string): number | null {
  if (!iso) return null;
  const restored = iso.replace(/(:\d{2})\s([+-]\d{2}:\d{2})$/, "$1+$2");
  const ms = Date.parse(restored);
  return Number.isNaN(ms) ? null : ms;
}
