import type { Repositories } from "@/lib/db/repos/types";
import { bookingReminder } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";
import { getStudioContext } from "./studio";

export interface ReminderSummary {
  queued: number;
  skipped: number;
}

export interface ReminderOptions {
  now?: () => string;
}

export async function runReminders(
  repos: Repositories,
  options: ReminderOptions = {},
): Promise<ReminderSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const currentTime = now();
  const nowDate = new Date(currentTime);
  const plus24hDate = new Date(nowDate.getTime() + 24 * 60 * 60 * 1000);
  const plus24h = plus24hDate.toISOString();

  const ctx = await getStudioContext(repos);
  const studioId = ctx.studio.id;

  const sessions = await repos.classSessions.listByStudio(studioId, {
    from: currentTime,
    to: plus24h,
  });

  const summary: ReminderSummary = { queued: 0, skipped: 0 };

  if (sessions.length === 0) {
    return summary;
  }

  const classTypes = await repos.classTypes.listByStudio(studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));

  const sessionIds = sessions.map((s) => s.id);
  const bookings = await repos.bookings.listBySessionIds(sessionIds);
  const bookedBookings = bookings.filter((b) => b.status === "booked");

  const existingReminders = await repos.outbox.listByKind("booking_reminder");
  const queuedBookingIds = new Set<string>();
  for (const row of existingReminders) {
    const payload = JSON.parse(row.payload) as { data?: { bookingId?: string } };
    if (payload.data?.bookingId) {
      queuedBookingIds.add(payload.data.bookingId);
    }
  }

  for (const booking of bookedBookings) {
    if (queuedBookingIds.has(booking.id)) {
      summary.skipped += 1;
      continue;
    }

    const member = await repos.members.getById(booking.memberId);
    if (!member || member.notificationsOptedOut) {
      summary.skipped += 1;
      continue;
    }

    const session = sessions.find((s) => s.id === booking.sessionId);
    if (!session) {
      summary.skipped += 1;
      continue;
    }

    const classType = typeById.get(session.classTypeId);
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
    summary.queued += 1;
  }

  return summary;
}
