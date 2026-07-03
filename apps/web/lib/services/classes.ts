import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { newId } from "@/lib/db/ids";
import { bookings, classSessions, classTypes } from "@/lib/db/schema";
import type { ClassType } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { type Occupancy, computeOccupancy } from "@/lib/domain/capacity";
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

export interface SessionRange {
  from?: string;
  to?: string;
}

export async function listClassTypes(db: Db, studioId: string): Promise<ClassType[]> {
  return db
    .select()
    .from(classTypes)
    .where(eq(classTypes.studioId, studioId))
    .orderBy(asc(classTypes.name));
}

export async function createClassType(
  db: Db,
  studioId: string,
  input: CreateClassTypeInput,
): Promise<ClassType> {
  const [classType] = await db
    .insert(classTypes)
    .values({
      id: newId("ct"),
      studioId,
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? "#6b7280",
      defaultCapacity: input.defaultCapacity,
      defaultPriceCents: input.defaultPriceCents,
    })
    .returning();
  return classType;
}

// Occupancy for a batch of sessions in one bookings query (no N+1).
async function occupancyBySession(
  db: Db,
  sessionIds: string[],
): Promise<Map<string, { status: string }[]>> {
  const grouped = new Map<string, { status: string }[]>();
  if (sessionIds.length === 0) return grouped;
  const rows = await db
    .select({ sessionId: bookings.sessionId, status: bookings.status })
    .from(bookings)
    .where(inArray(bookings.sessionId, sessionIds));
  for (const row of rows) {
    const bucket = grouped.get(row.sessionId);
    if (bucket) bucket.push({ status: row.status });
    else grouped.set(row.sessionId, [{ status: row.status }]);
  }
  return grouped;
}

export async function listSessions(
  db: Db,
  studioId: string,
  range: SessionRange = {},
): Promise<SessionView[]> {
  const filters = [eq(classSessions.studioId, studioId)];
  if (range.from) filters.push(gte(classSessions.startsAt, range.from));
  if (range.to) filters.push(lt(classSessions.startsAt, range.to));

  const rows = await db
    .select({
      id: classSessions.id,
      classTypeId: classSessions.classTypeId,
      classTypeName: classTypes.name,
      classTypeColor: classTypes.color,
      instructor: classSessions.instructor,
      startsAt: classSessions.startsAt,
      endsAt: classSessions.endsAt,
      capacity: classSessions.capacity,
      priceCents: classSessions.priceCents,
      status: classSessions.status,
    })
    .from(classSessions)
    .innerJoin(classTypes, eq(classTypes.id, classSessions.classTypeId))
    .where(and(...filters))
    .orderBy(asc(classSessions.startsAt));

  const occupancy = await occupancyBySession(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => ({
    ...row,
    occupancy: computeOccupancy(row.capacity, occupancy.get(row.id) ?? []),
  }));
}

export async function getSessionView(db: Db, id: string): Promise<SessionView> {
  const [session] = await listSessionsById(db, [id]);
  if (!session) throw new HttpError(404, "not_found", "Class session not found");
  return session;
}

async function listSessionsById(db: Db, ids: string[]): Promise<SessionView[]> {
  const rows = await db
    .select({
      id: classSessions.id,
      classTypeId: classSessions.classTypeId,
      classTypeName: classTypes.name,
      classTypeColor: classTypes.color,
      instructor: classSessions.instructor,
      startsAt: classSessions.startsAt,
      endsAt: classSessions.endsAt,
      capacity: classSessions.capacity,
      priceCents: classSessions.priceCents,
      status: classSessions.status,
    })
    .from(classSessions)
    .innerJoin(classTypes, eq(classTypes.id, classSessions.classTypeId))
    .where(inArray(classSessions.id, ids));
  const occupancy = await occupancyBySession(db, ids);
  return rows.map((row) => ({
    ...row,
    occupancy: computeOccupancy(row.capacity, occupancy.get(row.id) ?? []),
  }));
}

export async function createSession(
  db: Db,
  studioId: string,
  input: CreateSessionInput,
): Promise<SessionView> {
  const [classType] = await db
    .select()
    .from(classTypes)
    .where(and(eq(classTypes.id, input.classTypeId), eq(classTypes.studioId, studioId)))
    .limit(1);
  if (!classType) throw new HttpError(400, "bad_request", "Unknown class type for this studio");

  const [session] = await db
    .insert(classSessions)
    .values({
      id: newId("cs"),
      studioId,
      classTypeId: input.classTypeId,
      instructor: input.instructor,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity,
      priceCents: input.priceCents ?? classType.defaultPriceCents,
      status: "scheduled",
    })
    .returning();
  return getSessionView(db, session.id);
}
