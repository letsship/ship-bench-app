import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, Member, NotificationOutboxRow } from "@/lib/db/types";
import { isWithinReminderWindow, REMINDER_WINDOW_HOURS } from "@/lib/domain/reminders";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";
import type { NotificationKind } from "@/lib/notifications/types";
import { getStudioContext } from "./studio";

// The scheduler-driven 24-hour reminder job. It only QUEUES pending outbox rows;
// delivery stays with dispatchOutbox. Idempotency comes from the per-booking
// dedup set below, so an hourly cron still sends one reminder per seat.

const REMINDER_KIND: NotificationKind = "booking_reminder";

export interface RunRemindersOptions {
  now?: () => string;
  windowHours?: number;
}

export interface RunRemindersResult {
  queued: number;
}

// The bookingId every existing reminder was queued for. Reads ALL reminder rows
// (not just pending ones) so an already-delivered reminder is never re-queued.
function remindedBookingId(row: NotificationOutboxRow): string | null {
  try {
    const payload = JSON.parse(row.payload) as { data?: { bookingId?: unknown } };
    const bookingId = payload.data?.bookingId;
    return typeof bookingId === "string" ? bookingId : null;
  } catch (error) {
    console.error("reminder outbox row has an unreadable payload", { id: row.id, error });
    return null;
  }
}

async function alreadyRemindedBookingIds(repos: Repositories): Promise<Set<string>> {
  const rows = await repos.outbox.listByKind(REMINDER_KIND);
  return new Set(rows.map(remindedBookingId).filter((id): id is string => id !== null));
}

async function summaryOf(repos: Repositories, session: ClassSession): Promise<SessionSummary> {
  const classType = await repos.classTypes.getById(session.classTypeId);
  return {
    title: classType?.name ?? "Class",
    startsAt: session.startsAt,
    instructor: session.instructor,
  };
}

// A member gets a reminder only for a confirmed seat, and only if they have not
// opted out of notifications entirely.
function isRemindable(booking: Booking, alreadyReminded: Set<string>): boolean {
  return booking.status === "booked" && !alreadyReminded.has(booking.id);
}

async function queueReminder(
  repos: Repositories,
  booking: Booking,
  summary: SessionSummary,
): Promise<boolean> {
  const member: Member | null = await repos.members.getById(booking.memberId);
  if (!member || member.notificationsOptedOut) return false;
  await enqueueNotification(
    repos,
    bookingReminder(
      { memberId: member.id, email: member.email, name: member.name },
      summary,
      booking.id,
    ),
  );
  return true;
}

async function remindSession(
  repos: Repositories,
  session: ClassSession,
  alreadyReminded: Set<string>,
): Promise<number> {
  const bookings = (await repos.bookings.listBySession(session.id)).filter((booking) =>
    isRemindable(booking, alreadyReminded),
  );
  if (bookings.length === 0) return 0;

  const summary = await summaryOf(repos, session);
  let queued = 0;
  for (const booking of bookings) {
    alreadyReminded.add(booking.id);
    if (await queueReminder(repos, booking, summary)) queued += 1;
  }
  return queued;
}

export async function runReminders(
  repos: Repositories,
  options: RunRemindersOptions = {},
): Promise<RunRemindersResult> {
  const now = options.now?.() ?? new Date().toISOString();
  const windowHours = options.windowHours ?? REMINDER_WINDOW_HOURS;
  const { studio } = await getStudioContext(repos);

  const sessions = (await repos.classSessions.listByStudio(studio.id)).filter(
    (session) =>
      session.status !== "cancelled" && isWithinReminderWindow(session.startsAt, now, windowHours),
  );
  const alreadyReminded = await alreadyRemindedBookingIds(repos);

  let queued = 0;
  for (const session of sessions) {
    queued += await remindSession(repos, session, alreadyReminded);
  }
  return { queued };
}
