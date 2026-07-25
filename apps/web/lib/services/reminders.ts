import type { Repositories } from "@/lib/db/repos/types";
import { isConfirmedSeat, reminderWindow } from "@/lib/domain/reminders";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";
import type { NotificationProvider } from "@/lib/notifications/types";

const nowIso = (): string => new Date().toISOString();

function recipientOf(member: { id: string; email: string; name: string }) {
  return { memberId: member.id, email: member.email, name: member.name };
}

async function summaryOf(
  repos: Repositories,
  session: { classTypeId: string; startsAt: string; instructor: string },
): Promise<SessionSummary> {
  const classType = await repos.classTypes.getById(session.classTypeId);
  return {
    title: classType?.name ?? "Class",
    startsAt: session.startsAt,
    instructor: session.instructor,
  };
}

export interface RemindersResult {
  queued: number;
  skipped: number;
}

export async function queueClassReminders(
  repos: Repositories,
  provider: NotificationProvider,
  studioId: string,
): Promise<RemindersResult> {
  const now = nowIso();
  const window = reminderWindow(now);

  const sessions = await repos.classSessions.listByStudio(studioId, {
    from: window.from,
    to: window.to,
  });

  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length === 0) {
    return { queued: 0, skipped: 0 };
  }

  const bookings = await repos.bookings.listBySessionIds(sessionIds);
  const existingReminders = await repos.outbox.listByKind("booking_reminder");
  const existingBookingIds = new Set<string>();

  for (const row of existingReminders) {
    try {
      const payload = JSON.parse(row.payload);
      if (payload.data?.bookingId) {
        existingBookingIds.add(payload.data.bookingId);
      }
    } catch {
      // Skip malformed rows
    }
  }

  let queued = 0;
  let skipped = 0;

  for (const booking of bookings) {
    if (!isConfirmedSeat(booking.status)) {
      skipped += 1;
      continue;
    }

    if (existingBookingIds.has(booking.id)) {
      skipped += 1;
      continue;
    }

    const member = await repos.members.getById(booking.memberId);
    if (!member) {
      skipped += 1;
      continue;
    }

    if (member.notificationsOptedOut) {
      skipped += 1;
      continue;
    }

    const session = sessions.find((s) => s.id === booking.sessionId);
    if (!session) {
      skipped += 1;
      continue;
    }

    const message = bookingReminder(
      recipientOf(member),
      await summaryOf(repos, session),
      booking.id,
    );

    await enqueueNotification(repos, message);
    queued += 1;
  }

  return { queued, skipped };
}
