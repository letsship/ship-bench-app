import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, Member } from "@/lib/db/types";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification, shouldSend } from "@/lib/notifications/outbox";
import { getStudioContext } from "./studio";

const DAY_MS = 86_400_000;

function recipientOf(member: Member): { memberId: string; email: string; name: string } {
  return { memberId: member.id, email: member.email, name: member.name };
}

async function summaryOf(repos: Repositories, session: ClassSession): Promise<SessionSummary> {
  const classType = await repos.classTypes.getById(session.classTypeId);
  return {
    title: classType?.name ?? "Class",
    startsAt: session.startsAt,
    instructor: session.instructor,
  };
}

export interface RunRemindersOptions {
  now?: () => string;
}

export interface RunRemindersSummary {
  queued: number;
  skipped: number;
}

// Queue a booking_reminder outbox row for every confirmed seat in a session
// starting within the next 24 hours. Idempotent: a booking that already has a
// reminder queued (or dispatched) is skipped on subsequent runs. Notifications
// are queued only — never dispatched here.
export async function runReminders(
  repos: Repositories,
  options: RunRemindersOptions = {},
): Promise<RunRemindersSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const { studio, settings } = await getStudioContext(repos);
  const windowStart = now();
  const windowEnd = new Date(new Date(windowStart).getTime() + DAY_MS).toISOString();

  const sessions = await repos.classSessions.listByStudio(studio.id, {
    from: windowStart,
    to: windowEnd,
  });
  const bookings = (
    await repos.bookings.listBySessionIds(sessions.map((session) => session.id))
  ).filter((booking) => booking.status === "booked");

  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const summary: RunRemindersSummary = { queued: 0, skipped: 0 };

  for (const booking of bookings) {
    const session = sessionsById.get(booking.sessionId);
    const member = session ? await repos.members.getById(booking.memberId) : null;
    if (!session || !member) {
      summary.skipped += 1;
      continue;
    }

    if (
      !shouldSend("booking_reminder", { memberOptedOut: member.notificationsOptedOut, ...settings })
    ) {
      summary.skipped += 1;
      continue;
    }

    const dedupeKey = `booking_reminder:${booking.id}`;
    if (await repos.outbox.existsByDedupeKey(dedupeKey)) {
      summary.skipped += 1;
      continue;
    }

    await enqueueNotification(
      repos,
      bookingReminder(recipientOf(member), await summaryOf(repos, session)),
      dedupeKey,
    );
    summary.queued += 1;
  }

  return summary;
}
