import { and, asc, eq, gte, lt } from "drizzle-orm";
import { bookings, classSessions, classTypes, members } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";

export interface BookingRow {
  id: string;
  memberName: string;
  className: string;
  classColor: string;
  instructor: string;
  startsAt: string;
  status: string;
}

export interface BookingRange {
  from?: string;
  to?: string;
}

// Flat list of bookings joined to member + session + class type, ordered by
// session start. The /bookings page buckets these by day.
export async function listBookingRows(
  db: Db,
  studioId: string,
  range: BookingRange = {},
): Promise<BookingRow[]> {
  const filters = [eq(classSessions.studioId, studioId)];
  if (range.from) filters.push(gte(classSessions.startsAt, range.from));
  if (range.to) filters.push(lt(classSessions.startsAt, range.to));

  return db
    .select({
      id: bookings.id,
      memberName: members.name,
      className: classTypes.name,
      classColor: classTypes.color,
      instructor: classSessions.instructor,
      startsAt: classSessions.startsAt,
      status: bookings.status,
    })
    .from(bookings)
    .innerJoin(classSessions, eq(classSessions.id, bookings.sessionId))
    .innerJoin(classTypes, eq(classTypes.id, classSessions.classTypeId))
    .innerJoin(members, eq(members.id, bookings.memberId))
    .where(and(...filters))
    .orderBy(asc(classSessions.startsAt));
}
