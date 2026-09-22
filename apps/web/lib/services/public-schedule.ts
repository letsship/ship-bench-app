// Service to list a studio's public schedule for website embedding.
// Composes repositories, domain helpers, and occupancy math to produce a PII-free response.

import type { Repositories } from "@/lib/db/repos/types";
import { computeOccupancy } from "@/lib/domain/capacity";
import {
  isCancelled,
  publicScheduleWindow,
  toPublicClass,
  type PublicClass,
} from "@/lib/domain/public-schedule";

export async function listPublicSchedule(
  repos: Repositories,
  studioId: string,
  now: Date,
): Promise<PublicClass[]> {
  const window = publicScheduleWindow(now);

  // Fetch sessions for this studio in the 14-day window.
  // repos.classSessions.listByStudio() scopes strictly to studioId, so no cross-studio leakage.
  const sessions = await repos.classSessions.listByStudio(studioId, {
    from: window.from,
    to: window.to,
  });

  // If no sessions, return early.
  if (sessions.length === 0) {
    return [];
  }

  // Load the class types and bookings for these sessions.
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const sessionIds = sessions.map((s) => s.id);
  const bookings = await repos.bookings.listBySessionIds(sessionIds);

  // Build a map of sessionId -> classType for quick lookup.
  const classTypeById = new Map(classTypes.map((ct) => [ct.id, ct]));

  // Build a map of sessionId -> bookings for occupancy computation.
  const bookingsBySessionId = new Map<string, typeof bookings>();
  bookings.forEach((booking) => {
    if (!bookingsBySessionId.has(booking.sessionId)) {
      bookingsBySessionId.set(booking.sessionId, []);
    }
    bookingsBySessionId.get(booking.sessionId)!.push(booking);
  });

  // Filter out cancelled sessions and map to PublicClass.
  const publicClasses = sessions
    .filter((session) => !isCancelled(session))
    .map((session) => {
      const classType = classTypeById.get(session.classTypeId);
      if (!classType) {
        // Shouldn't happen with referential integrity, but be defensive.
        return null;
      }

      const sessionBookings = bookingsBySessionId.get(session.id) ?? [];
      const occupancy = computeOccupancy(session.capacity, sessionBookings);

      return toPublicClass(session, classType, occupancy);
    })
    .filter((pc): pc is PublicClass => pc !== null);

  return publicClasses;
}
