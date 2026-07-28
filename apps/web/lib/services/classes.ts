import { newId } from "@/lib/db/ids";
import type { Repositories, SessionRange } from "@/lib/db/repos/types";
import type { Booking, ClassSession, ClassType } from "@/lib/db/types";
import { SEAT_TAKING_STATUSES, type Occupancy, computeOccupancy } from "@/lib/domain/capacity";
import { HttpError } from "@/lib/http";
import type { CreateClassTypeInput, CreateSessionInput } from "@/lib/validation";

export interface SessionView {
  id: string;
  classTypeId: string;
  classTypeName: string;
  classTypeColor: string;
  instructor: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  priceCents: number;
  status: string;
  occupancy: Occupancy;
}

export async function listClassTypes(repos: Repositories, studioId: string): Promise<ClassType[]> {
  return repos.classTypes.listByStudio(studioId);
}

export async function createClassType(
  repos: Repositories,
  studioId: string,
  input: CreateClassTypeInput,
): Promise<ClassType> {
  return repos.classTypes.insert({
    id: newId(),
    studioId,
    name: input.name,
    description: input.description ?? null,
    color: input.color ?? "#6b7280",
    defaultCapacity: input.defaultCapacity,
    defaultPriceCents: input.defaultPriceCents,
    createdAt: new Date().toISOString(),
  });
}

function groupBookings(bookings: Booking[]): Map<string, Booking[]> {
  const grouped = new Map<string, Booking[]>();
  for (const booking of bookings) {
    const bucket = grouped.get(booking.sessionId);
    if (bucket) bucket.push(booking);
    else grouped.set(booking.sessionId, [booking]);
  }
  return grouped;
}

function toView(
  session: ClassSession,
  classType: ClassType | undefined,
  bookings: Booking[],
): SessionView {
  return {
    id: session.id,
    classTypeId: session.classTypeId,
    classTypeName: classType?.name ?? "Class",
    classTypeColor: classType?.color ?? "#6b7280",
    instructor: session.instructor,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    capacity: session.capacity,
    priceCents: session.priceCents,
    status: session.status,
    occupancy: computeOccupancy(session.capacity, bookings),
  };
}

export async function listSessions(
  repos: Repositories,
  studioId: string,
  range: SessionRange = {},
): Promise<SessionView[]> {
  const sessions = await repos.classSessions.listByStudio(studioId, range);
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const bySession = groupBookings(await repos.bookings.listBySessionIds(sessions.map((s) => s.id)));
  return sessions.map((session) =>
    toView(session, typeById.get(session.classTypeId), bySession.get(session.id) ?? []),
  );
}

// Upcoming sessions the given member holds a confirmed (seat-taking) booking
// in — the source for the member's private calendar feed. Past sessions drop
// out via the `from` range; waitlisted/cancelled bookings hold no seat.
export async function listMemberUpcomingSessions(
  repos: Repositories,
  studioId: string,
  memberId: string,
  from: string,
): Promise<SessionView[]> {
  const sessions = await listSessions(repos, studioId, { from });
  const bookings = await repos.bookings.listBySessionIds(sessions.map((s) => s.id));
  const held = new Set(
    bookings
      .filter(
        (booking) =>
          booking.memberId === memberId &&
          (SEAT_TAKING_STATUSES as readonly string[]).includes(booking.status),
      )
      .map((booking) => booking.sessionId),
  );
  return sessions.filter((session) => held.has(session.id));
}

export async function getSessionView(repos: Repositories, id: string): Promise<SessionView> {
  const session = await repos.classSessions.getById(id);
  if (!session) throw new HttpError(404, "not_found", "Class session not found");
  const classType = await repos.classTypes.getById(session.classTypeId);
  const bookings = await repos.bookings.listBySession(id);
  return toView(session, classType ?? undefined, bookings);
}

export async function createSession(
  repos: Repositories,
  studioId: string,
  input: CreateSessionInput,
): Promise<SessionView> {
  const classType = await repos.classTypes.getById(input.classTypeId);
  if (!classType || classType.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown class type for this studio");
  }
  const session = await repos.classSessions.insert({
    id: newId(),
    studioId,
    classTypeId: input.classTypeId,
    instructor: input.instructor,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    capacity: input.capacity,
    priceCents: input.priceCents ?? classType.defaultPriceCents,
    status: "scheduled",
    createdAt: new Date().toISOString(),
  });
  return getSessionView(repos, session.id);
}
