import type { Repositories, SessionRange } from "@/lib/db/repos/types";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";

export interface RunRemindersResult {
  sessionsProcessed: number;
  notificationsQueued: number;
}

export async function runReminders(repos: Repositories, now: Date): Promise<RunRemindersResult> {
  const nowIso = now.toISOString();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const studioContext = await repos.studios.getFirst();
  if (!studioContext) {
    return { sessionsProcessed: 0, notificationsQueued: 0 };
  }

  const range: SessionRange = {
    from: nowIso,
    to: in24Hours,
  };

  const sessions = await repos.classSessions.listByStudio(studioContext.id, range);
  const pending = await repos.outbox.listPending();
  let notificationsQueued = 0;

  for (const session of sessions) {
    const bookings = await repos.bookings.listBySession(session.id);
    const bookedBookings = bookings.filter((b) => b.status === "booked");

    for (const booking of bookedBookings) {
      const member = await repos.members.getById(booking.memberId);
      if (!member) continue;
      if (member.notificationsOptedOut) continue;

      const settings = await repos.settings.getByStudioId(studioContext.id);
      if (settings && !settings.notifyReminders) continue;

      const dedupeKey = `booking_reminder:${session.id}:${member.id}`;
      const alreadyQueued = pending.some((row) => row.dedupeKey === dedupeKey);
      if (alreadyQueued) continue;

      const classType = await repos.classTypes.getById(session.classTypeId);
      const sessionSummary: SessionSummary = {
        title: classType?.name ?? "Class",
        startsAt: session.startsAt,
        instructor: session.instructor,
      };

      await enqueueNotification(
        repos,
        bookingReminder(
          { memberId: member.id, email: member.email, name: member.name },
          sessionSummary,
        ),
        dedupeKey,
      );
      notificationsQueued += 1;
    }
  }

  return { sessionsProcessed: sessions.length, notificationsQueued };
}
