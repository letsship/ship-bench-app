import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, Member, NotificationOutboxRow } from "@/lib/db/types";
import { isConfirmedSeat, reminderWindow } from "@/lib/domain/reminders";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";
import { getStudioContext } from "./studio";

const REMINDER_KIND = "booking_reminder";

function recipientOf(member: Member) {
  return { memberId: member.id, email: member.email, name: member.name };
}

function sessionSummary(session: ClassSession, title: string): SessionSummary {
  return { title, startsAt: session.startsAt, instructor: session.instructor };
}

function bookingIdOf(row: NotificationOutboxRow): string | null {
  try {
    const payload = JSON.parse(row.payload) as { data?: { bookingId?: unknown } };
    return typeof payload.data?.bookingId === "string" ? payload.data.bookingId : null;
  } catch {
    console.error("Invalid notification outbox payload", row.id);
    return null;
  }
}

export interface ReminderRunOptions {
  now?: string;
}

export async function runReminders(
  repos: Repositories,
  options: ReminderRunOptions = {},
): Promise<{ queued: number; skipped: number }> {
  const { studio } = await getStudioContext(repos);
  const now = options.now ?? new Date().toISOString();
  const window = reminderWindow(now);
  const sessions = await repos.classSessions.listByStudio(studio.id, window);
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));
  const existing = new Set(
    (await repos.outbox.listByKind(REMINDER_KIND)).map(bookingIdOf).filter((id): id is string => id !== null),
  );
  const sessionTitles = new Map(
    await Promise.all(
      sessions.map(async (session) => {
        const classType = await repos.classTypes.getById(session.classTypeId);
        return [session.id, classType?.name ?? "Class"] as const;
      }),
    ),
  );
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  let queued = 0;
  let skipped = 0;

  for (const booking of bookings) {
    if (!isConfirmedSeat(booking.status)) continue;
    if (existing.has(booking.id)) {
      skipped += 1;
      continue;
    }
    const member = await repos.members.getById(booking.memberId);
    if (!member || member.notificationsOptedOut) {
      skipped += 1;
      continue;
    }
    const session = sessionById.get(booking.sessionId);
    if (!session) continue;
    await enqueueNotification(
      repos,
      bookingReminder(
        recipientOf(member),
        sessionSummary(session, sessionTitles.get(session.id) ?? "Class"),
        booking.id,
      ),
    );
    existing.add(booking.id);
    queued += 1;
  }

  return { queued, skipped };
}
