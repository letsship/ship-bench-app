import type { Repositories } from "@/lib/db/repos/types";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";

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

export interface RemindersOptions {
  now?: () => string;
}

export interface RemindersSummary {
  queued: number;
  skipped: number;
}

export async function runReminders(
  repos: Repositories,
  studioId: string,
  options: RemindersOptions = {},
): Promise<RemindersSummary> {
  const now = options.now ?? nowIso;
  const nowStr = now();
  const windowEnd = new Date(new Date(nowStr).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const sessions = await repos.classSessions.listByStudio(studioId, {
    from: nowStr,
    to: windowEnd,
  });

  if (sessions.length === 0) {
    return { queued: 0, skipped: 0 };
  }

  const sessionIds = sessions.map((s) => s.id);
  const bookings = await repos.bookings.listBySessionIds(sessionIds);

  const bookedBookings = bookings.filter((b) => b.status === "booked");

  const existingReminders = await repos.outbox.listByKind("booking_reminder");
  const existingBookingIds = new Set(
    existingReminders
      .map((row) => {
        try {
          const payload = JSON.parse(row.payload);
          return payload.data?.bookingId;
        } catch {
          return null;
        }
      })
      .filter((id): id is string => id !== null),
  );

  let queued = 0;
  let skipped = 0;

  for (const booking of bookedBookings) {
    if (existingBookingIds.has(booking.id)) {
      skipped += 1;
      continue;
    }

    const member = await repos.members.getById(booking.memberId);
    if (!member || member.notificationsOptedOut) {
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

  skipped += bookings.length - bookedBookings.length;

  return { queued, skipped };
}
