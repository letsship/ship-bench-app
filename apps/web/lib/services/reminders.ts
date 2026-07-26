import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, Member } from "@/lib/db/types";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification, shouldSend } from "@/lib/notifications/outbox";
import { getStudioContext } from "./studio";

const DAY_MS = 86_400_000;

interface ReminderPayload {
  data?: { bookingId?: string };
}

async function alreadyReminded(repos: Repositories): Promise<Set<string>> {
  const rows = await repos.outbox.listByKind("booking_reminder");
  const ids = rows
    .map((row) => (JSON.parse(row.payload) as ReminderPayload).data?.bookingId)
    .filter((id): id is string => Boolean(id));
  return new Set(ids);
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

export interface SendClassRemindersOptions {
  now?: () => string;
}

export interface SendClassRemindersSummary {
  queued: number;
}

// Queue a booking_reminder for every confirmed (booked) seat in a session
// starting within the next 24 hours. Safe to call repeatedly: bookings that
// already have a queued reminder (delivered or not) are never re-queued.
export async function sendClassReminders(
  repos: Repositories,
  options: SendClassRemindersOptions = {},
): Promise<SendClassRemindersSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const { studio, settings } = await getStudioContext(repos);

  const from = now();
  const to = new Date(new Date(from).getTime() + DAY_MS).toISOString();
  const sessions = (await repos.classSessions.listByStudio(studio.id, { from, to })).filter(
    (session) => session.status !== "cancelled",
  );
  if (sessions.length === 0) return { queued: 0 };

  const bookings = (await repos.bookings.listBySessionIds(sessions.map((s) => s.id))).filter(
    (booking) => booking.status === "booked",
  );
  const reminded = await alreadyReminded(repos);
  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  let queued = 0;
  for (const booking of bookings) {
    if (reminded.has(booking.id)) continue;
    const session = sessionById.get(booking.sessionId);
    if (!session) continue;
    const member = await repos.members.getById(booking.memberId);
    if (!member) continue;
    if (
      !shouldSend("booking_reminder", { memberOptedOut: member.notificationsOptedOut, ...settings })
    ) {
      continue;
    }
    await enqueueNotification(
      repos,
      bookingReminder(recipientOf(member), await summaryOf(repos, session), booking.id),
    );
    queued += 1;
  }
  return { queued };
}
