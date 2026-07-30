import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, Member, NotificationOutboxRow } from "@/lib/db/types";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";
import { getStudioContext } from "./studio";

// Idempotent 24-hour class reminder job. Finds every class session starting
// within the next 24 hours and queues a pending `booking_reminder` outbox row
// for each member holding a confirmed (booked) seat — skipping waitlisted
// seats, opted-out members, and bookings that already have a reminder queued.
// It only enqueues; dispatch happens later in dispatchOutbox. Safe to call
// repeatedly (e.g. hourly cron): a booking never gets a second reminder row.

const HOUR_MS = 3_600_000;
const REMINDER_WINDOW_MS = 24 * HOUR_MS;

export interface ReminderOptions {
  now?: () => string;
}

export interface ReminderSummary {
  queued: number;
  skippedOptedOut: number;
  alreadyQueued: number;
}

function recipientOf(member: Member) {
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

// The outbox payload stores `data.bookingId` (see enqueueNotification), so a
// prior reminder row self-identifies the booking it belongs to. Returning both
// pending and already-sent rows is what keeps idempotency across dispatch.
function bookingIdOf(row: NotificationOutboxRow): string | null {
  try {
    const payload = JSON.parse(row.payload) as { data?: { bookingId?: unknown } };
    const id = payload.data?.bookingId;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

async function remindedBookingIds(repos: Repositories): Promise<Set<string>> {
  const rows = await repos.outbox.listByKind("booking_reminder");
  return new Set(rows.map(bookingIdOf).filter((id): id is string => id !== null));
}

export async function runReminders(
  repos: Repositories,
  options: ReminderOptions = {},
): Promise<ReminderSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const { studio } = await getStudioContext(repos);
  const from = now();
  const to = new Date(new Date(from).getTime() + REMINDER_WINDOW_MS).toISOString();

  const sessions = await repos.classSessions.listByStudio(studio.id, { from, to });
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const bookings = sessions.length
    ? await repos.bookings.listBySessionIds(sessions.map((session) => session.id))
    : [];
  const memberById = new Map(
    (await repos.members.listByStudio(studio.id)).map((member) => [member.id, member]),
  );
  const alreadyReminded = await remindedBookingIds(repos);

  const summary: ReminderSummary = { queued: 0, skippedOptedOut: 0, alreadyQueued: 0 };
  for (const booking of bookings.filter((row) => row.status === "booked")) {
    const member = memberById.get(booking.memberId);
    if (!member) continue;
    if (member.notificationsOptedOut) {
      summary.skippedOptedOut += 1;
      continue;
    }
    if (alreadyReminded.has(booking.id)) {
      summary.alreadyQueued += 1;
      continue;
    }
    const session = sessionById.get(booking.sessionId);
    if (!session) continue;
    await enqueueNotification(
      repos,
      bookingReminder(recipientOf(member), await summaryOf(repos, session), {
        bookingId: booking.id,
        sessionId: session.id,
      }),
    );
    summary.queued += 1;
  }

  return summary;
}
