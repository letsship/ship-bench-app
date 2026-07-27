import type { Repositories } from "@/lib/db/repos/types";
import type { Member } from "@/lib/db/types";
import { classReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";

const DAY_MS = 86_400_000;

export interface ReminderOptions {
  now?: () => string;
}

export interface ReminderSummary {
  queued: number;
  skipped: number;
}

function recipientOf(member: Member): { memberId: string; email: string; name: string } {
  return { memberId: member.id, email: member.email, name: member.name };
}

// Queue a booking_reminder for every confirmed (booked) seat in a class
// session starting within the next 24 hours. Idempotent: already-queued
// reminders (pending or sent) are looked up by bookingId and skipped, so
// calling this repeatedly (e.g. from an hourly cron) never double-queues.
export async function runReminders(
  repos: Repositories,
  studioId: string,
  options: ReminderOptions = {},
): Promise<ReminderSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const windowStart = now();
  const windowEnd = new Date(new Date(windowStart).getTime() + DAY_MS).toISOString();

  const sessions = await repos.classSessions.listByStudio(studioId, {
    from: windowStart,
    to: windowEnd,
  });
  const sessionIds = sessions.map((session) => session.id);
  const bookings = (await repos.bookings.listBySessionIds(sessionIds)).filter(
    (booking) => booking.status === "booked",
  );

  const existingReminders = await repos.outbox.listByKind("booking_reminder");
  const alreadyReminded = new Set(
    existingReminders.map(
      (row) => (JSON.parse(row.payload) as { data: { bookingId: string } }).data.bookingId,
    ),
  );

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const classTypeNameById = new Map<string, string>();

  let queued = 0;
  let skipped = 0;
  for (const booking of bookings) {
    if (alreadyReminded.has(booking.id)) {
      skipped += 1;
      continue;
    }
    const session = sessionById.get(booking.sessionId);
    const member = session ? await repos.members.getById(booking.memberId) : null;
    if (!session || !member || member.notificationsOptedOut) {
      skipped += 1;
      continue;
    }

    let className = classTypeNameById.get(session.classTypeId);
    if (className === undefined) {
      const classType = await repos.classTypes.getById(session.classTypeId);
      className = classType?.name ?? "Class";
      classTypeNameById.set(session.classTypeId, className);
    }
    const summary: SessionSummary = {
      title: className,
      startsAt: session.startsAt,
      instructor: session.instructor,
    };

    await enqueueNotification(repos, classReminder(recipientOf(member), summary, booking.id));
    queued += 1;
  }

  return { queued, skipped };
}
