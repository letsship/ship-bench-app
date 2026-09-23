import type { Repositories, SessionRange } from "@/lib/db/repos/types";
import { isWithinInclusiveRange } from "@/lib/domain/dates";
import type { Booking, ClassSession, ClassType, Member } from "@/lib/db/types";

export interface BookingRow {
  id: string;
  memberName: string;
  className: string;
  classColor: string;
  instructor: string;
  startsAt: string;
  status: string;
}

export interface BookingExportRow {
  startsAt: string;
  className: string;
  memberName: string;
  email: string;
  status: string;
}

// The session/classType/member lookup shared by both booking-list views, built
// once per request so the join stays in the service and repositories stay
// single-entity.
interface BookingJoinLookup {
  sessionById: Map<string, ClassSession>;
  typeById: Map<string, ClassType>;
  memberById: Map<string, Member>;
}

async function buildBookingJoinLookup(
  repos: Repositories,
  studioId: string,
  sessions: ClassSession[],
): Promise<BookingJoinLookup> {
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const members = await repos.members.listByStudio(studioId);
  return {
    sessionById: new Map(sessions.map((session) => [session.id, session])),
    typeById: new Map(classTypes.map((type) => [type.id, type])),
    memberById: new Map(members.map((member) => [member.id, member])),
  };
}

// Resolve the single booking's joined session/class type/member, if present.
function joinBooking(booking: Booking, lookup: BookingJoinLookup) {
  const session = lookup.sessionById.get(booking.sessionId);
  const classType = session ? lookup.typeById.get(session.classTypeId) : undefined;
  const member = lookup.memberById.get(booking.memberId);
  return { session, classType, member };
}

// Flat list of bookings joined (in-memory) to member + session + class type,
// ordered by session start. The /bookings page buckets these by day. The join
// happens here in the service so repositories stay single-entity.
export async function listBookingRows(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId, range);
  const lookup = await buildBookingJoinLookup(repos, studioId, sessions);
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));

  return bookings
    .map((booking) => {
      const { session, classType, member } = joinBooking(booking, lookup);
      return {
        id: booking.id,
        memberName: member?.name ?? "—",
        className: classType?.name ?? "Class",
        classColor: classType?.color ?? "#6b7280",
        instructor: session?.instructor ?? "",
        startsAt: session?.startsAt ?? "",
        status: booking.status,
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// All bookings in a studio, filtered to sessions whose start falls within
// [range.from, range.to] inclusive of both bounds (unlike `listBookingRows`,
// whose `SessionRange.to` is exclusive for calendar views). Sorted by session
// start. Includes the member's email, which the bookings list view does not.
export async function listBookingExportRows(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<BookingExportRow[]> {
  const sessions = await repos.classSessions.listByStudio(studioId);
  const inRange = sessions.filter((session) =>
    isWithinInclusiveRange(session.startsAt, range.from, range.to),
  );
  const lookup = await buildBookingJoinLookup(repos, studioId, inRange);
  const bookings = await repos.bookings.listBySessionIds(inRange.map((session) => session.id));

  return bookings
    .map((booking) => {
      const { session, classType, member } = joinBooking(booking, lookup);
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
