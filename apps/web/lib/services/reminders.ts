import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, Member, NotificationOutboxRow } from "@/lib/db/types";
import { type SessionSummary, bookingReminder } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";
import { getStudioContext } from "./studio";

// The 24-hour class reminder job. A cron hits the route repeatedly, so this
// only ever QUEUES pending outbox rows (delivery stays dispatchOutbox's job)
// and skips bookings that already have a reminder queued or sent — running it
// hourly must not produce hourly reminders.

const REMINDER_KIND = "booking_reminder";
const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ReminderOptions {
  now?: () => string;
}

export interface ReminderSummary {
  queued: number;
}

const recipientOf = (member: Member) => ({
  memberId: member.id,
  email: member.email,
  name: member.name,
});

const summaryOf = (session: ClassSession, titles: Map<string, string>): SessionSummary => ({
  title: titles.get(session.classTypeId) ?? "Class",
  startsAt: session.startsAt,
  instructor: session.instructor,
});

// The idempotency key: the bookingId the reminder message carried in `data`.
function remindedBookingId(row: NotificationOutboxRow): string | null {
  try {
    const payload = JSON.parse(row.payload) as { data?: { bookingId?: unknown } };
    return typeof payload.data?.bookingId === "string" ? payload.data.bookingId : null;
  } catch (error) {
    console.error("unreadable reminder payload", { id: row.id, error });
    return null;
  }
}

async function queueReminder(
  repos: Repositories,
  booking: Booking,
  summary: SessionSummary,
): Promise<boolean> {
  const member = await repos.members.getById(booking.memberId);
  if (!member || member.notificationsOptedOut) return false;
  await enqueueNotification(repos, bookingReminder(recipientOf(member), summary, booking.id));
  return true;
}

export async function runBookingReminders(
  repos: Repositories,
  options: ReminderOptions = {},
): Promise<ReminderSummary> {
  const { studio } = await getStudioContext(repos);
  const from = (options.now ?? (() => new Date().toISOString()))();
  const to = new Date(new Date(from).getTime() + WINDOW_MS).toISOString();
  const sessions = (await repos.classSessions.listByStudio(studio.id, { from, to })).filter(
    (session) => session.status !== "cancelled",
  );
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const titles = new Map(
    (await repos.classTypes.listByStudio(studio.id)).map((type) => [type.id, type.name]),
  );

  const alreadyReminded = new Set(
    (await repos.outbox.listByKind(REMINDER_KIND))
      .map(remindedBookingId)
      .filter((id): id is string => id !== null),
  );
  // Only a confirmed seat earns a reminder — waitlisted members are excluded.
  const due = (await repos.bookings.listBySessionIds([...byId.keys()])).filter(
    (booking) => booking.status === "booked" && !alreadyReminded.has(booking.id),
  );

  let queued = 0;
  for (const booking of due) {
    const session = byId.get(booking.sessionId);
    if (!session) continue;
    if (await queueReminder(repos, booking, summaryOf(session, titles))) queued += 1;
  }
  return { queued };
}
