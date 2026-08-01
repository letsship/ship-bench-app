import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, Member, NotificationOutboxRow } from "@/lib/db/types";
import { hoursBetween } from "@/lib/domain/dates";
import { type SessionSummary, bookingReminder } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";
import type { NotificationProvider } from "@/lib/notifications/types";
import { getStudioContext } from "./studio";

// Queue a day-before reminder for every confirmed seat in a class starting
// within the next 24 hours. Cron-safe: a booking that already has a
// booking_reminder outbox row (pending or sent) is never queued again, so the
// endpoint can be hit hourly without double-sending. Reminders are enqueued
// only — delivery stays with the outbox dispatcher.

const REMINDER_KIND = "booking_reminder";
const WINDOW_HOURS = 24;

export interface ReminderSummary {
  queued: number;
  skipped: number;
}

export interface RunRemindersOptions {
  now?: () => string;
}

function startsWithinWindow(session: ClassSession, nowIso: string): boolean {
  const hoursUntilStart = hoursBetween(nowIso, session.startsAt);
  return hoursUntilStart >= 0 && hoursUntilStart < WINDOW_HOURS;
}

// The bookingId each reminder row was queued for, read back from its payload.
function remindedBookingId(row: NotificationOutboxRow): string | null {
  try {
    const payload = JSON.parse(row.payload) as { data?: { bookingId?: unknown } };
    return typeof payload.data?.bookingId === "string" ? payload.data.bookingId : null;
  } catch (error) {
    console.error("unparseable outbox payload", { id: row.id, error });
    return null;
  }
}

async function summaryOf(repos: Repositories, session: ClassSession): Promise<SessionSummary> {
  const classType = await repos.classTypes.getById(session.classTypeId);
  return {
    title: classType?.name ?? "Class",
    startsAt: session.startsAt,
    instructor: session.instructor,
  };
}

function recipientOf(member: Member): { memberId: string; email: string; name: string } {
  return { memberId: member.id, email: member.email, name: member.name };
}

async function queueReminder(
  repos: Repositories,
  booking: Booking,
  session: ClassSession,
): Promise<boolean> {
  const member = await repos.members.getById(booking.memberId);
  if (!member || member.notificationsOptedOut) return false;
  await enqueueNotification(
    repos,
    bookingReminder(recipientOf(member), await summaryOf(repos, session), {
      bookingId: booking.id,
      sessionId: session.id,
    }),
  );
  return true;
}

// The provider is part of the standard service signature but unused here:
// reminders only enqueue pending rows; dispatch is a separate concern.
export async function runReminders(
  repos: Repositories,
  _provider: NotificationProvider,
  options: RunRemindersOptions = {},
): Promise<ReminderSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const { studio } = await getStudioContext(repos);

  const from = now();
  const to = new Date(new Date(from).getTime() + WINDOW_HOURS * 3_600_000).toISOString();
  const sessions = (await repos.classSessions.listByStudio(studio.id, { from, to })).filter(
    (session) => session.status === "scheduled" && startsWithinWindow(session, from),
  );
  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  const seats = (await repos.bookings.listBySessionIds([...sessionById.keys()])).filter(
    (booking) => booking.status === "booked",
  );
  const alreadyReminded = new Set(
    (await repos.outbox.listByKind(REMINDER_KIND)).map(remindedBookingId),
  );

  const summary: ReminderSummary = { queued: 0, skipped: 0 };
  for (const booking of seats) {
    const session = sessionById.get(booking.sessionId);
    const queued =
      session && !alreadyReminded.has(booking.id)
        ? await queueReminder(repos, booking, session)
        : false;
    summary[queued ? "queued" : "skipped"] += 1;
  }
  return summary;
}
