// Public schedule DTO and helpers for the unauthenticated /api/public/schedule endpoint.
// These are pure functions with no framework/database/request imports.

import type { ClassSession, ClassType } from "../db/types";
import type { Occupancy } from "./capacity";

export interface PublicClass {
  title: string;
  startsAt: string;
  durationMinutes: number;
  instructor: string;
  seatsAvailable: number;
}

export interface ScheduleWindow {
  from: string;
  to: string;
}

// Returns a 14-day window from now (inclusive) to now + 14 days (exclusive).
// Matches the repo's existing SessionRange semantics: from-inclusive, to-exclusive.
export function publicScheduleWindow(now: Date): ScheduleWindow {
  const from = now.toISOString();
  const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

// Check if a session is cancelled.
export function isCancelled(session: ClassSession): boolean {
  return session.status === "cancelled";
}

// Map a session to a PublicClass DTO, computing duration and seats available.
// The DTO includes ONLY the five public fields: title, startsAt, durationMinutes,
// instructor, seatsAvailable. No member, booking, or invoice data.
export function toPublicClass(
  session: ClassSession,
  classType: ClassType,
  occupancy: Occupancy,
): PublicClass {
  const startMs = new Date(session.startsAt).getTime();
  const endMs = new Date(session.endsAt).getTime();
  const durationMinutes = Math.round((endMs - startMs) / 60_000);

  return {
    title: classType.name,
    startsAt: session.startsAt,
    durationMinutes,
    instructor: session.instructor,
    seatsAvailable: occupancy.available,
  };
}
