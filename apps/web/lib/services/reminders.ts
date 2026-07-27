import type { Repositories } from "@/lib/db/repos/types";
import { bookingReminder } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";
import { getStudioContext } from "./studio";

export interface RemindersOptions {
  now?: () => string;
}

export interface RemindersSummary {
  queued: number;
  skipped: number;
}

export async function runReminders(
  repos: Repositories,
  options: RemindersOptions = {},
): Promise<RemindersSummary> {
  const nowFn = options.now ?? (() => new Date().toISOString());
  const now = nowFn();

  const { studio } = await getStudioContext(repos);

  const nowDate = new Date(now);
  const tomorrowDate = new Date(nowDate.getTime() + 24 * 60 * 60 * 1000);
  const from = now;
  const to = tomorrowDate.toISOString();

  const sessions = await repos.classSessions.listByStudio(studio.id, { from, to });
  const activeSessions = sessions.filter((s) => s.status !== "cancelled");

  if (activeSessions.length === 0) {
    return { queued: 0, skipped: 0 };
  }

  const sessionIds = activeSessions.map((s) => s.id);
  const bookings = await repos.bookings.listBySessionIds(sessionIds);
  const bookedBookings = bookings.filter((b) => b.status === "booked");

  const existingReminders = await repos.outbox.listByKind("booking_reminder");
  const existingBookingIds = new Set<string>();
  for (const row of existingReminders) {
    const payload = JSON.parse(row.payload);
    if (payload.data?.bookingId) {
      existingBookingIds.add(payload.data.bookingId);
    }
  }

  let queued = 0;
  let skipped = 0;

  for (const booking of bookedBookings) {
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

    const session = activeSessions.find((s) => s.id === booking.sessionId);
    if (!session) {
      skipped += 1;
      continue;
    }

    const classType = await repos.classTypes.getById(session.classTypeId);
    const message = bookingReminder(
      { memberId: member.id, email: member.email, name: member.name },
      {
        title: classType?.name ?? "Class",
        startsAt: session.startsAt,
        instructor: session.instructor,
      },
      booking.id,
    );

    await enqueueNotification(repos, message);
    queued += 1;
  }

  return { queued, skipped };
}
