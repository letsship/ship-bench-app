import type { Repositories } from "@/lib/db/repos/types";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";
import { selectBookingsToRemind } from "@/lib/domain/reminders";
import { getStudioContext } from "./studio";

export interface RemindersOptions {
  now?: () => string;
}

export interface RemindersSummary {
  queued: number;
}

export async function runReminders(
  repos: Repositories,
  options: RemindersOptions = {},
): Promise<RemindersSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const nowIso = now();
  const { studio } = await getStudioContext(repos);

  // Compute the 24h window: [now, now+24h)
  const nowMs = new Date(nowIso).getTime();
  const windowStart = new Date(nowMs).toISOString();
  const windowEnd = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();

  // Fetch in-window sessions (filter to scheduled status; cancelled sessions are skipped by startsAt comparison)
  const inWindowSessions = await repos.classSessions.listByStudio(studio.id, {
    from: windowStart,
    to: windowEnd,
  });

  // If no sessions, return early
  if (inWindowSessions.length === 0) {
    return { queued: 0 };
  }

  // Gather all bookings for these sessions
  const sessionIds = inWindowSessions.map((s) => s.id);
  const bookings = await repos.bookings.listBySessionIds(sessionIds);

  // Load all members
  const members = await repos.members.listByStudio(studio.id);
  const memberMap = new Map(members.map((m) => [m.id, m]));

  // List existing 'booking_reminder' outbox rows to build the already-reminded set
  const existingReminders = await repos.outbox.listByKind("booking_reminder");
  const alreadyRemindedBookingIds = new Set<string>();
  for (const row of existingReminders) {
    const payload = JSON.parse(row.payload) as {
      data?: { bookingId?: string };
    };
    if (payload.data?.bookingId) {
      alreadyRemindedBookingIds.add(payload.data.bookingId);
    }
  }

  // Apply the domain rule to select bookings to remind
  const toRemind = selectBookingsToRemind({
    sessions: inWindowSessions,
    bookings,
    members: memberMap,
    alreadyRemindedBookingIds,
    now: nowIso,
  });

  // Enqueue a reminder notification for each selected booking
  let queued = 0;
  for (const { booking, member, session } of toRemind) {
    const classType = await repos.classTypes.getById(session.classTypeId);
    const summary: SessionSummary = {
      title: classType?.name ?? "Class",
      startsAt: session.startsAt,
      instructor: session.instructor,
    };
    const message = bookingReminder(
      {
        memberId: member.id,
        email: member.email,
        name: member.name,
      },
      summary,
      booking.id,
    );
    await enqueueNotification(repos, message);
    queued += 1;
  }

  return { queued };
}
