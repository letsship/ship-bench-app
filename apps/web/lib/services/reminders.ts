import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, Member } from "@/lib/db/types";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";
import { getStudioContext } from "./studio";

const DAY_MS = 24 * 60 * 60 * 1000;

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

function remindedBookingIds(payloads: string[]): Set<string> {
  const ids = new Set<string>();
  for (const payload of payloads) {
    const parsed = JSON.parse(payload) as { data?: { bookingId?: unknown } };
    const bookingId = parsed.data?.bookingId;
    if (typeof bookingId === "string") ids.add(bookingId);
  }
  return ids;
}

export interface RunRemindersOptions {
  now?: () => string;
}

export interface RunRemindersSummary {
  queued: number;
}

// Queue a `booking_reminder` outbox row for every member holding a confirmed
// (booked) seat in a class session starting within the next 24 hours. Queue
// only — delivery happens later via dispatchOutbox. Idempotent: bookings that
// already have a reminder queued (pending or sent) are skipped, so calling
// this repeatedly (e.g. an hourly cron) never double-reminds a member.
export async function runReminders(
  repos: Repositories,
  options: RunRemindersOptions = {},
): Promise<RunRemindersSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const { studio } = await getStudioContext(repos);
  const from = now();
  const to = new Date(new Date(from).getTime() + DAY_MS).toISOString();

  const sessions = (await repos.classSessions.listByStudio(studio.id, { from, to })).filter(
    (session) => session.status === "scheduled",
  );
  if (sessions.length === 0) return { queued: 0 };

  const bookings = (await repos.bookings.listBySessionIds(sessions.map((s) => s.id))).filter(
    (booking) => booking.status === "booked",
  );

  const alreadyReminded = remindedBookingIds(
    (await repos.outbox.listByKind("booking_reminder")).map((row) => row.payload),
  );

  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  let queued = 0;
  for (const booking of bookings) {
    if (alreadyReminded.has(booking.id)) continue;
    const session = sessionsById.get(booking.sessionId);
    if (!session) continue;
    const member = await repos.members.getById(booking.memberId);
    if (!member || member.notificationsOptedOut) continue;

    await enqueueNotification(
      repos,
      bookingReminder(recipientOf(member), await summaryOf(repos, session), booking.id),
    );
    queued += 1;
  }
  return { queued };
}
