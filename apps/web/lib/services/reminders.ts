import type { Repositories } from "@/lib/db/repos/types";
import { isBefore } from "@/lib/domain/dates";
import { bookingReminder } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";

export interface RemindersOptions {
  now?: () => string;
}

export interface RemindersResult {
  queued: number;
  skipped: number;
}

export async function runReminders(
  repos: Repositories,
  options: RemindersOptions = {},
): Promise<RemindersResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const nowIso = now();
  const studioNow = nowIso;
  const studioIn24h = new Date(new Date(nowIso).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const studio = await repos.studios.getFirst();
  if (!studio) {
    return { queued: 0, skipped: 0 };
  }

  const sessions = await repos.classSessions.listByStudio(studio.id);
  const inWindow = sessions.filter(
    (session) => isBefore(studioNow, session.startsAt) && isBefore(session.startsAt, studioIn24h),
  );

  const sessionIds = inWindow.map((s) => s.id);
  const allBookings = await repos.bookings.listBySessionIds(sessionIds);
  const existingReminders = await repos.outbox.listByKind("booking_reminder");

  const result: RemindersResult = { queued: 0, skipped: 0 };

  for (const session of inWindow) {
    const sessionBookings = allBookings.filter((b) => b.sessionId === session.id);
    const bookedSeats = sessionBookings.filter((b) => b.status === "booked");

    for (const booking of bookedSeats) {
      const member = await repos.members.getById(booking.memberId);
      if (!member) {
        result.skipped += 1;
        continue;
      }

      if (member.notificationsOptedOut) {
        result.skipped += 1;
        continue;
      }

      const alreadyQueued = existingReminders.some(
        (row) =>
          row.memberId === member.id &&
          row.kind === "booking_reminder" &&
          JSON.parse(row.payload).data?.sessionId === session.id,
      );

      if (alreadyQueued) {
        result.skipped += 1;
        continue;
      }

      const classType = await repos.classTypes.getById(session.classTypeId);
      const message = bookingReminder(
        { memberId: member.id, email: member.email, name: member.name },
        {
          title: classType?.name ?? "Class",
          startsAt: session.startsAt,
          instructor: session.instructor,
          sessionId: session.id,
        },
      );

      try {
        await enqueueNotification(repos, message);
        result.queued += 1;
      } catch (error) {
        console.error("Failed to enqueue reminder", {
          sessionId: session.id,
          memberId: member.id,
          error,
        });
        result.skipped += 1;
      }
    }
  }

  return result;
}
