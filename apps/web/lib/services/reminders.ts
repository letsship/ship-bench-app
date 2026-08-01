import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, Member, NotificationOutboxRow } from "@/lib/db/types";
import { reminderWindow, selectReminders } from "@/lib/domain/reminders";
import { type SessionSummary, bookingReminder } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";

const REMINDER_KIND = "booking_reminder";

export interface RunRemindersOptions {
  // Injectable clock so tests can pin the 24h window.
  now?: () => string;
}

export interface RemindersSummary {
  queued: number;
}

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

// The bookingId stashed in the row's payload data is the idempotency key; a
// row whose payload cannot be read never blocks the run.
function remindedBookingId(row: NotificationOutboxRow): string | null {
  try {
    const payload = JSON.parse(row.payload) as { data?: { bookingId?: unknown } };
    return typeof payload.data?.bookingId === "string" ? payload.data.bookingId : null;
  } catch (error) {
    console.error("reminders: unreadable outbox payload", { id: row.id, error });
    return null;
  }
}

// Queue a booking_reminder outbox row for every confirmed seat in a session
// starting within the next 24 hours. Idempotent: bookings that already have a
// reminder row (pending or sent) are skipped, so an hourly cron queues at most
// one reminder per booking. Delivery stays with the outbox dispatcher.
export async function runReminders(
  repos: Repositories,
  studioId: string,
  options: RunRemindersOptions = {},
): Promise<RemindersSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const window = reminderWindow(now());
  const sessions = await repos.classSessions.listByStudio(studioId, window);
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));
  const members = await repos.members.listByStudio(studioId);
  const reminded = await repos.outbox.listByKind(REMINDER_KIND);

  const selected = selectReminders({
    sessions,
    bookings,
    members,
    alreadyRemindedBookingIds: new Set(
      reminded.map(remindedBookingId).filter((id): id is string => id !== null),
    ),
    ...window,
  });

  const membersById = new Map(members.map((member) => [member.id, member]));
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  let queued = 0;
  for (const booking of selected) {
    const member = membersById.get(booking.memberId);
    const session = sessionsById.get(booking.sessionId);
    if (!member || !session) continue;
    await enqueueNotification(
      repos,
      bookingReminder(recipientOf(member), await summaryOf(repos, session), booking.id),
    );
    queued += 1;
  }
  return { queued };
}
