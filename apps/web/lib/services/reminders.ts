import type { Repositories } from "@/lib/db/repos/types";
import { enqueueNotification } from "@/lib/notifications/outbox";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { selectSessionsDueForReminder } from "@/lib/domain/reminders";

export interface ReminderSummary {
  queued: number;
  skipped: number;
}

export interface RunRemindersOptions {
  now?: () => string;
}

export async function runReminders(
  repos: Repositories,
  studioId: string,
  options: RunRemindersOptions = {},
): Promise<ReminderSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const nowIso = now();

  const from = nowIso;
  const to = new Date(new Date(nowIso).getTime() + 25 * 3_600_000).toISOString();
  const rawSessions = await repos.classSessions.listByStudio(studioId, { from, to });

  const dueSessionIds = selectSessionsDueForReminder(rawSessions, nowIso).map((s) => s.id);
  if (dueSessionIds.length === 0) return { queued: 0, skipped: 0 };

  const allBookings = await repos.bookings.listBySessionIds(dueSessionIds);
  const confirmedBookings = allBookings.filter((b) => b.status === "booked");
  if (confirmedBookings.length === 0) return { queued: 0, skipped: 0 };

  const memberIds = [...new Set(confirmedBookings.map((b) => b.memberId))];
  const members = await Promise.all(memberIds.map((id) => repos.members.getById(id)));
  const memberMap = new Map(members.filter(Boolean).map((m) => [m!.id, m!]));

  const existingRows = await repos.outbox.listByKind("booking_reminder");
  const existingBookingIds = new Set<string>();
  for (const row of existingRows) {
    try {
      const payload = JSON.parse(row.payload) as { data?: { bookingId?: string } };
      if (payload.data?.bookingId) existingBookingIds.add(payload.data.bookingId);
    } catch {
      // skip malformed payloads
    }
  }

  const classTypeIds = [...new Set(rawSessions.map((s) => s.classTypeId))];
  const classTypes = await Promise.all(classTypeIds.map((id) => repos.classTypes.getById(id)));
  const classTypeMap = new Map(classTypes.filter(Boolean).map((ct) => [ct!.id, ct!]));

  const sessionMap = new Map(rawSessions.map((s) => [s.id, s]));

  let queued = 0;
  let skipped = 0;

  for (const booking of confirmedBookings) {
    if (existingBookingIds.has(booking.id)) {
      skipped += 1;
      continue;
    }

    const member = memberMap.get(booking.memberId);
    if (!member || member.notificationsOptedOut) {
      skipped += 1;
      continue;
    }

    const session = sessionMap.get(booking.sessionId);
    if (!session) {
      skipped += 1;
      continue;
    }

    const classType = classTypeMap.get(session.classTypeId);
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
        { bookingId: booking.id, sessionId: session.id },
      ),
    );

    queued += 1;
  }

  return { queued, skipped };
}