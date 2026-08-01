import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, NotificationOutboxRow } from "@/lib/db/types";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";

export interface ReminderOptions {
  now?: () => string;
}

function reminderBookingId(row: NotificationOutboxRow): string | null {
  try {
    const payload: unknown = JSON.parse(row.payload);
    if (!payload || typeof payload !== "object") return null;
    const data = (payload as { data?: unknown }).data;
    if (!data || typeof data !== "object") return null;
    const bookingId = (data as { bookingId?: unknown }).bookingId;
    return typeof bookingId === "string" ? bookingId : null;
  } catch {
    return null;
  }
}

async function summaryOf(repos: Repositories, session: ClassSession): Promise<SessionSummary> {
  const classType = await repos.classTypes.getById(session.classTypeId);
  return {
    title: classType?.name ?? "Class",
    startsAt: session.startsAt,
    instructor: session.instructor,
  };
}

export async function runReminders(
  repos: Repositories,
  options: ReminderOptions = {},
): Promise<{ queued: number }> {
  const now = options.now ?? (() => new Date().toISOString());
  const from = now();
  const to = new Date(new Date(from).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const studio = await repos.studios.getFirst();
  if (!studio) return { queued: 0 };

  const sessions = (await repos.classSessions.listByStudio(studio.id, { from, to })).filter(
    (session) => session.status !== "cancelled",
  );
  const bookings = (await repos.bookings.listBySessionIds(sessions.map((session) => session.id))).filter(
    (booking) => booking.status === "booked",
  );
  const reminded = new Set(
    (await repos.outbox.listByKind("booking_reminder"))
      .map(reminderBookingId)
      .filter((bookingId): bookingId is string => bookingId !== null),
  );
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  let queued = 0;

  for (const booking of bookings) {
    if (reminded.has(booking.id)) continue;
    const member = await repos.members.getById(booking.memberId);
    const session = sessionById.get(booking.sessionId);
    if (!member || member.notificationsOptedOut || !session) continue;
    await enqueueNotification(
      repos,
      bookingReminder(
        { memberId: member.id, email: member.email, name: member.name },
        await summaryOf(repos, session),
        booking.id,
      ),
    );
    reminded.add(booking.id);
    queued += 1;
  }

  return { queued };
}
