import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, NotificationOutboxRow } from "@/lib/db/types";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";
import type { NotificationRecipient } from "@/lib/notifications/types";
import { getStudioContext } from "./studio";

// The 24-hour class reminder job. A scheduler (cron) drives it through
// POST /api/reminders/run; it only QUEUES pending outbox rows — delivery stays
// with dispatchOutbox. Idempotent: the bookingId persisted in each reminder
// row's payload is the dedupe key, so repeat runs never double-remind.

const REMINDER_WINDOW_MS = 24 * 3_600_000;

export interface ReminderSummary {
  queued: number;
  skipped: number;
}

export interface RunRemindersOptions {
  now?: () => string;
}

// Confirmed seats (status "booked") in the window's sessions — waitlisted or
// cancelled bookings never produce a reminder.
async function confirmedBookings(
  repos: Repositories,
  sessions: ClassSession[],
): Promise<Booking[]> {
  const ids = sessions.map((session) => session.id);
  return (await repos.bookings.listBySessionIds(ids)).filter(
    (booking) => booking.status === "booked",
  );
}

// Booking ids that already have a booking_reminder row — pending OR sent, so a
// delivered reminder also blocks a re-queue. Read back from the row payload.
function remindedBookingIds(rows: NotificationOutboxRow[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload) as { data?: { bookingId?: unknown } };
      if (typeof payload.data?.bookingId === "string") ids.add(payload.data.bookingId);
    } catch (error) {
      console.error("reminders: unreadable outbox payload", { id: row.id, error });
    }
  }
  return ids;
}

// A reminder goes only to a member who exists and has not opted out.
async function recipientFor(
  repos: Repositories,
  booking: Booking,
): Promise<NotificationRecipient | null> {
  const member = await repos.members.getById(booking.memberId);
  if (!member || member.notificationsOptedOut) return null;
  return { memberId: member.id, email: member.email, name: member.name };
}

export async function runReminders(
  repos: Repositories,
  options: RunRemindersOptions = {},
): Promise<ReminderSummary> {
  const nowIso = options.now ?? (() => new Date().toISOString());
  const { studio } = await getStudioContext(repos);
  const from = nowIso();
  const to = new Date(new Date(from).getTime() + REMINDER_WINDOW_MS).toISOString();

  const sessions = await repos.classSessions.listByStudio(studio.id, { from, to });
  const bookings = await confirmedBookings(repos, sessions);
  const alreadyReminded = remindedBookingIds(await repos.outbox.listByKind("booking_reminder"));
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const titles = new Map(
    (await repos.classTypes.listByStudio(studio.id)).map((type) => [type.id, type.name]),
  );

  const summary: ReminderSummary = { queued: 0, skipped: 0 };
  for (const booking of bookings) {
    const session = sessionById.get(booking.sessionId);
    if (!session || alreadyReminded.has(booking.id)) {
      summary.skipped += 1;
      continue;
    }
    const recipient = await recipientFor(repos, booking);
    if (!recipient) {
      summary.skipped += 1;
      continue;
    }
    const sessionSummary: SessionSummary = {
      title: titles.get(session.classTypeId) ?? "Class",
      startsAt: session.startsAt,
      instructor: session.instructor,
    };
    await enqueueNotification(repos, bookingReminder(recipient, sessionSummary, booking.id));
    summary.queued += 1;
  }
  return summary;
}
