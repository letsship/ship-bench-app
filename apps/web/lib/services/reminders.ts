import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, Member } from "@/lib/db/types";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification, shouldSend } from "@/lib/notifications/outbox";

export interface RunBookingRemindersOptions {
  now?: () => string;
}

export interface RunBookingRemindersSummary {
  queued: number;
  skipped: number;
}

async function summaryOf(repos: Repositories, session: ClassSession): Promise<SessionSummary> {
  const classType = await repos.classTypes.getById(session.classTypeId);
  return {
    title: classType?.name ?? "Class",
    startsAt: session.startsAt,
    instructor: session.instructor,
  };
}

function recipientOf(member: Member): { memberId: string; email: string; name: string } {
  return { memberId: member.id, email: member.email, name: member.name };
}

function parsePayloadForBookingId(payload: string): string | null {
  try {
    const data = JSON.parse(payload);
    return data.data?.bookingId ?? null;
  } catch (err) {
    console.error("Failed to parse booking_reminder payload:", err);
    return null;
  }
}

export async function runBookingReminders(
  repos: Repositories,
  studioId: string,
  options: RunBookingRemindersOptions = {},
): Promise<RunBookingRemindersSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const nowTime = now();
  const nowDate = new Date(nowTime);
  const in24HoursDate = new Date(nowDate.getTime() + 24 * 60 * 60 * 1000);

  const sessions = await repos.classSessions.listByStudio(studioId, {
    from: nowTime,
    to: in24HoursDate.toISOString(),
  });

  if (sessions.length === 0) {
    return { queued: 0, skipped: 0 };
  }

  const sessionIds = sessions.map((s) => s.id);
  const bookings = await repos.bookings.listBySessionIds(sessionIds);
  const bookedBookings = bookings.filter((b) => b.status === "booked");

  if (bookedBookings.length === 0) {
    return { queued: 0, skipped: 0 };
  }

  const alreadyQueued = await repos.outbox.listByKind("booking_reminder");
  const remindedBookingIds = new Set<string>();
  for (const row of alreadyQueued) {
    const bookingId = parsePayloadForBookingId(row.payload);
    if (bookingId) {
      remindedBookingIds.add(bookingId);
    }
  }

  const settings = await repos.settings.getByStudioId(studioId);
  if (!settings) {
    return { queued: 0, skipped: 0 };
  }

  const summary: RunBookingRemindersSummary = { queued: 0, skipped: 0 };

  for (const booking of bookedBookings) {
    if (remindedBookingIds.has(booking.id)) {
      summary.skipped += 1;
      continue;
    }

    const member = await repos.members.getById(booking.memberId);
    if (!member) {
      summary.skipped += 1;
      continue;
    }

    const shouldQueue = shouldSend("booking_reminder", {
      memberOptedOut: member.notificationsOptedOut,
      notifyBookingConfirmations: settings.notifyBookingConfirmations,
      notifyCancellations: settings.notifyCancellations,
      notifyWaitlistPromotions: settings.notifyWaitlistPromotions,
      notifyInvoices: settings.notifyInvoices,
      notifyBookingReminders: settings.notifyBookingReminders,
    });

    if (!shouldQueue) {
      summary.skipped += 1;
      continue;
    }

    const session = sessions.find((s) => s.id === booking.sessionId);
    if (!session) {
      summary.skipped += 1;
      continue;
    }

    const sessionSummary = await summaryOf(repos, session);
    const message = bookingReminder(
      recipientOf(member),
      sessionSummary,
      booking.id,
      booking.sessionId,
    );

    await enqueueNotification(repos, message);
    summary.queued += 1;
  }

  return summary;
}
