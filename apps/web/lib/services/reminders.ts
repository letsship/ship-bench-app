import type { Repositories } from "@/lib/db/repos/types";
import type {
  Booking,
  ClassSession,
  ClassType,
  Member,
  NotificationOutboxRow,
} from "@/lib/db/types";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";
import { getStudioContext } from "./studio";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RunRemindersOptions {
  now?: () => string;
}

export interface ReminderRunSummary {
  queued: number;
  skippedOptedOut: number;
  skippedDuplicate: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function reminderBookingId(row: NotificationOutboxRow): string | null {
  try {
    const payload: unknown = JSON.parse(row.payload);
    if (!isRecord(payload) || !isRecord(payload.data)) return null;
    return typeof payload.data.bookingId === "string" ? payload.data.bookingId : null;
  } catch (error) {
    console.error("failed to parse reminder outbox payload", { id: row.id, error });
    return null;
  }
}

function recipientOf(member: Member): { memberId: string; email: string; name: string } {
  return { memberId: member.id, email: member.email, name: member.name };
}

function summaryOf(session: ClassSession, classType: ClassType | undefined): SessionSummary {
  return {
    sessionId: session.id,
    title: classType?.name ?? "Class",
    startsAt: session.startsAt,
    instructor: session.instructor,
  };
}

function bookingsBySession(bookings: Booking[]): Map<string, Booking[]> {
  return bookings.reduce((grouped, booking) => {
    const sessionBookings = grouped.get(booking.sessionId) ?? [];
    grouped.set(booking.sessionId, [...sessionBookings, booking]);
    return grouped;
  }, new Map<string, Booking[]>());
}

export async function runReminders(
  repos: Repositories,
  options: RunRemindersOptions = {},
): Promise<ReminderRunSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const from = now();
  const through = new Date(new Date(from).getTime() + DAY_MS).toISOString();
  const exclusiveTo = new Date(new Date(through).getTime() + 1).toISOString();
  const { studio } = await getStudioContext(repos);
  const sessionsInRange = await repos.classSessions.listByStudio(studio.id, {
    from,
    to: exclusiveTo,
  });
  const sessions = sessionsInRange.filter((session) => session.startsAt <= through);
  const bookings = await repos.bookings.listBySessionIds(sessions.map((session) => session.id));
  const members = await repos.members.listByStudio(studio.id);
  const classTypes = await repos.classTypes.listByStudio(studio.id);
  const existing = await repos.outbox.listByKind("booking_reminder");
  const remindedBookingIds = new Set(
    existing.map(reminderBookingId).filter((bookingId): bookingId is string => bookingId !== null),
  );
  const memberById = new Map(members.map((member) => [member.id, member]));
  const classTypeById = new Map(classTypes.map((classType) => [classType.id, classType]));
  const sessionBookings = bookingsBySession(bookings);
  const summary: ReminderRunSummary = { queued: 0, skippedOptedOut: 0, skippedDuplicate: 0 };

  for (const session of sessions) {
    const confirmed = (sessionBookings.get(session.id) ?? []).filter(
      (booking) => booking.status === "booked",
    );
    for (const booking of confirmed) {
      if (remindedBookingIds.has(booking.id)) {
        summary.skippedDuplicate += 1;
        continue;
      }
      const member = memberById.get(booking.memberId);
      if (!member) continue;
      if (member.notificationsOptedOut) {
        summary.skippedOptedOut += 1;
        continue;
      }
      await enqueueNotification(
        repos,
        bookingReminder(
          recipientOf(member),
          summaryOf(session, classTypeById.get(session.classTypeId)),
          booking.id,
        ),
      );
      remindedBookingIds.add(booking.id);
      summary.queued += 1;
    }
  }

  return summary;
}
