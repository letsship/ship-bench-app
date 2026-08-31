import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, Member } from "@/lib/db/types";
import { addHours } from "@/lib/domain/dates";
import {
  bookingReminder,
  type SessionSummary,
} from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";

// 24-hour class reminder job. Safe to call repeatedly: a booking that already
// has a queued (or sent) `booking_reminder` row is never queued again. Only
// confirmed (`booked`) seats are reminded — waitlisted/cancelled seats are
// skipped — and members who opted out of notifications get nothing. The job
// only enqueues pending outbox rows; delivery happens in the outbox dispatcher.

export interface ReminderSummary {
  queued: number;
  skipped: number;
}

export interface RunRemindersOptions {
  // Injectable clock for deterministic tests. Defaults to `new Date()`.
  now?: () => string;
}

const REMINDER_KIND = "booking_reminder";
const WINDOW_HOURS = 24;

function recipientOf(member: Member) {
  return { memberId: member.id, email: member.email, name: member.name };
}

async function summaryOf(
  repos: Repositories,
  session: ClassSession,
): Promise<SessionSummary> {
  const classType = await repos.classTypes.getById(session.classTypeId);
  return {
    title: classType?.name ?? "Class",
    startsAt: session.startsAt,
    instructor: session.instructor,
  };
}

// Parse `data.bookingId` from a queued outbox row so idempotency can key on it.
// Rows queued by `bookingReminder` always carry it; older/other rows fall back
// to `undefined` and simply never match.
function bookingIdOf(row: { payload: string }): string | undefined {
  try {
    const parsed = JSON.parse(row.payload) as { data?: Record<string, unknown> };
    const bookingId = parsed.data?.bookingId;
    return typeof bookingId === "string" ? bookingId : undefined;
  } catch {
    return undefined;
  }
}

export async function runReminders(
  repos: Repositories,
  studioId: string,
  options: RunRemindersOptions = {},
): Promise<ReminderSummary> {
  const now = options.now ? options.now() : new Date().toISOString();
  const windowEnd = addHours(now, WINDOW_HOURS);

  const sessions = await repos.classSessions.listByStudio(studioId, {
    from: now,
    to: windowEnd,
  });
  const upcoming = sessions.filter((session) => session.status === "scheduled");
  if (upcoming.length === 0) return { queued: 0, skipped: 0 };

  const sessionIds = upcoming.map((session) => session.id);
  const bookings = await repos.bookings.listBySessionIds(sessionIds);
  const confirmed = bookings.filter((booking) => booking.status === "booked");

  // Build the set of booking ids that already have a reminder queued (pending
  // or sent) so a repeat run does not double-queue.
  const alreadyReminded = new Set<string>();
  const prior = await repos.outbox.listByKind(REMINDER_KIND);
  for (const row of prior) {
    const bookingId = bookingIdOf(row);
    if (bookingId) alreadyReminded.add(bookingId);
  }

  const sessionById = new Map(upcoming.map((session) => [session.id, session] as const));

  let queued = 0;
  let skipped = 0;

  for (const booking of confirmed) {
    if (alreadyReminded.has(booking.id)) {
      skipped += 1;
      continue;
    }
    const member = await repos.members.getById(booking.memberId);
    if (!member || member.notificationsOptedOut) {
      skipped += 1;
      continue;
    }
    const session = sessionById.get(booking.sessionId);
    if (!session) {
      skipped += 1;
      continue;
    }
    await enqueueNotification(
      repos,
      bookingReminder(recipientOf(member), await summaryOf(repos, session), booking.id),
    );
    queued += 1;
  }

  return { queued, skipped };
}
