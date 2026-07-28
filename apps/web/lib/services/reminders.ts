import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession } from "@/lib/db/types";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";

export interface RunRemindersOptions {
  /** Injectable clock — defaults to `new Date().toISOString()`. */
  now?: () => string;
}

function sessionSummary(
  session: ClassSession,
  classTypeNames: Map<string, string>,
): SessionSummary {
  return {
    title: classTypeNames.get(session.classTypeId) ?? "Class",
    startsAt: session.startsAt,
    instructor: session.instructor,
  };
}

/**
 * Queue a `booking_reminder` notification for every confirmed (booked) seat in
 * a class session that starts within the next 24 hours.
 *
 * Idempotent: bookings that already have a queued (or sent) `booking_reminder`
 * row in the outbox are skipped. Members who have opted out of notifications
 * are skipped. Waitlisted and cancelled bookings are skipped.
 *
 * Returns the count of reminders queued in this run.
 */
export async function runReminders(
  repos: Repositories,
  studioId: string,
  options: RunRemindersOptions = {},
): Promise<number> {
  const nowIso = options.now?.() ?? new Date().toISOString();
  const nowMs = new Date(nowIso).getTime();
  const endIso = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();

  // 1. Find class sessions starting in the next 24 hours.
  const sessions = await repos.classSessions.listByStudio(studioId, {
    from: nowIso,
    to: endIso,
  });
  if (sessions.length === 0) return 0;

  const sessionIds = sessions.map((s) => s.id);

  // 2. Load class type names for building session summaries.
  const classTypes = await repos.classTypes.listByStudio(studioId);
  const classTypeNames = new Map(classTypes.map((ct) => [ct.id, ct.name]));

  // 3. Pull bookings for those sessions, keep only confirmed seats.
  const allBookings = await repos.bookings.listBySessionIds(sessionIds);
  const confirmedBookings = allBookings.filter((b) => b.status === "booked");
  if (confirmedBookings.length === 0) return 0;

  // 4. Load existing booking_reminder rows for idempotency.
  const existingReminders = await repos.outbox.listByKind("booking_reminder");
  const alreadyQueuedBookingIds = new Set<string>();
  for (const row of existingReminders) {
    try {
      const payload = JSON.parse(row.payload) as { data?: { bookingId?: string } };
      const bookingId = payload.data?.bookingId;
      if (bookingId) alreadyQueuedBookingIds.add(bookingId);
    } catch {
      // Malformed payload — skip so the booking gets a reminder on retry.
    }
  }

  // 5. Index sessions by id for fast summary lookup.
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  // 6. For each confirmed booking, load the member and enqueue if eligible.
  let queued = 0;
  for (const booking of confirmedBookings) {
    // Skip if this booking already has a reminder queued.
    if (alreadyQueuedBookingIds.has(booking.id)) continue;

    const member = await repos.members.getById(booking.memberId);
    if (!member || member.notificationsOptedOut) continue;

    const session = sessionById.get(booking.sessionId);
    if (!session) continue;

    await enqueueNotification(
      repos,
      bookingReminder(
        {
          memberId: member.id,
          email: member.email,
          name: member.name,
        },
        sessionSummary(session, classTypeNames),
        booking.id,
      ),
    );
    queued += 1;
  }

  return queued;
}