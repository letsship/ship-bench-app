import type { Repositories } from "@/lib/db/repos/types";
import { bookingReminder } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";

export interface RemindersOptions {
  now?: () => string;
}

export interface RemindersSummary {
  queued: number;
}

function addHours(isoString: string, hours: number): string {
  const date = new Date(isoString);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function recipientOf(member: { id: string; email: string; name: string }) {
  return { memberId: member.id, email: member.email, name: member.name };
}

export async function runReminders(
  repos: Repositories,
  studioId: string,
  options: RemindersOptions = {},
): Promise<RemindersSummary> {
  const now = options.now ? options.now() : new Date().toISOString();
  const windowStart = now;
  const windowEnd = addHours(now, 24);

  const sessions = await repos.classSessions.listByStudio(studioId, {
    from: windowStart,
    to: windowEnd,
  });

  if (sessions.length === 0) {
    return { queued: 0 };
  }

  const sessionIds = sessions.map((s) => s.id);
  const allBookings = await repos.bookings.listBySessionIds(sessionIds);
  const bookedBookings = allBookings.filter((b) => b.status === "booked");

  let queued = 0;

  for (const booking of bookedBookings) {
    const member = await repos.members.getById(booking.memberId);
    if (!member || member.notificationsOptedOut) {
      continue;
    }

    const existing = await repos.outbox.listByMemberAndKind(member.id, "booking_reminder");
    const alreadyQueued = existing.some((row) => {
      const payload = JSON.parse(row.payload) as { data: Record<string, unknown> };
      return payload.data.bookingId === booking.id;
    });

    if (alreadyQueued) {
      continue;
    }

    const session = sessions.find((s) => s.id === booking.sessionId);
    if (!session) continue;

    const classType = await repos.classTypes.getById(session.classTypeId);
    const sessionSummary = {
      title: classType?.name ?? "Class",
      startsAt: session.startsAt,
      instructor: session.instructor,
    };

    await enqueueNotification(
      repos,
      bookingReminder(recipientOf(member), sessionSummary, booking.id, session.id),
    );
    queued += 1;
  }

  return { queued };
}
