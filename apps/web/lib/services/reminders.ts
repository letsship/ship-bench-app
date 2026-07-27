import type { Repositories } from "@/lib/db/repos/types";
import { bookingReminder } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";

function recipientOf(member: { id: string; email: string; name: string }) {
  return { memberId: member.id, email: member.email, name: member.name };
}

async function summaryOf(
  repos: Repositories,
  session: { classTypeId: string; startsAt: string; instructor: string },
) {
  const classType = await repos.classTypes.getById(session.classTypeId);
  return {
    title: classType?.name ?? "Class",
    startsAt: session.startsAt,
    instructor: session.instructor,
  };
}

export interface QueueRemindersResult {
  queued: number;
}

export interface QueueRemindersOptions {
  now?: () => string;
}

export async function queueClassReminders(
  repos: Repositories,
  studioId: string,
  options: QueueRemindersOptions = {},
): Promise<QueueRemindersResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const currentTime = now();
  const windowStart = currentTime;
  const windowEnd = new Date(new Date(currentTime).getTime() + 24 * 60 * 60 * 1000).toISOString();

  // Get sessions in the 24-hour window, excluding cancelled ones
  const sessions = await repos.classSessions.listByStudio(studioId, {
    from: windowStart,
    to: windowEnd,
  });
  const scheduledSessions = sessions.filter((s) => s.status !== "cancelled");

  if (scheduledSessions.length === 0) {
    return { queued: 0 };
  }

  const sessionIds = scheduledSessions.map((s) => s.id);

  // Get all bookings for these sessions
  const bookings = await repos.bookings.listBySessionIds(sessionIds);

  // Keep only confirmed (booked) seats
  const bookedBookings = bookings.filter((b) => b.status === "booked");

  // Get already-queued reminders for deduplication
  const existingReminders = await repos.outbox.listByKind("booking_reminder");
  const queuedBookingIds = new Set<string>();
  for (const row of existingReminders) {
    try {
      const payload = JSON.parse(row.payload) as { data?: { bookingId?: string } };
      if (payload.data?.bookingId) {
        queuedBookingIds.add(payload.data.bookingId);
      }
    } catch {
      // Malformed payload, skip
    }
  }

  // Queue reminders for members who:
  // 1. Have a confirmed booking
  // 2. Haven't already been queued a reminder for this booking
  // 3. Haven't opted out of notifications
  let queued = 0;
  for (const booking of bookedBookings) {
    if (queuedBookingIds.has(booking.id)) {
      continue; // Already queued for this booking
    }

    const member = await repos.members.getById(booking.memberId);
    if (!member || member.notificationsOptedOut) {
      continue; // Member doesn't exist or has opted out
    }

    const session = scheduledSessions.find((s) => s.id === booking.sessionId);
    if (!session) continue;

    await enqueueNotification(
      repos,
      bookingReminder(recipientOf(member), await summaryOf(repos, session), booking.id),
    );
    queued += 1;
  }

  return { queued };
}
