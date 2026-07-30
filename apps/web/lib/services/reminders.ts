import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, Member } from "@/lib/db/types";
import { bookingReminder, type SessionSummary } from "@/lib/notifications/messages";
import { enqueueNotification } from "@/lib/notifications/outbox";
import { getStudioContext } from "./studio";

// The day-before class reminder job. A scheduler POSTs the endpoint (hourly is
// fine) and this queues exactly one pending `booking_reminder` outbox row per
// confirmed seat in a session starting inside the next 24 hours. Delivery stays
// with the existing dispatchOutbox path.

const REMINDER_KIND = "booking_reminder";
const WINDOW_MS = 24 * 60 * 60 * 1000;

// A seat is confirmed only when it is `booked` — waitlisted, cancelled, and
// attendance statuses never earn a reminder.
const CONFIRMED_STATUS = "booked";

export interface ReminderRunResult {
  queued: number;
}

export interface RunClassRemindersOptions {
  now?: string;
}

// The bookingIds we have already reminded, read back out of each reminder row's
// payload. There is no bookingId column, so the payload `data` carries the key.
async function remindedBookingIds(repos: Repositories): Promise<Set<string>> {
  const rows = await repos.outbox.listByKind(REMINDER_KIND);
  const ids = rows.map((row) => bookingIdOf(row.payload)).filter((id): id is string => id !== null);
  return new Set(ids);
}

function bookingIdOf(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload) as { data?: { bookingId?: unknown } };
    const bookingId = parsed.data?.bookingId;
    return typeof bookingId === "string" ? bookingId : null;
  } catch (error) {
    console.error("reminder outbox payload is not valid JSON", error);
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

// The confirmed seats in this session that still need a reminder.
async function seatsToRemind(
  repos: Repositories,
  session: ClassSession,
  reminded: Set<string>,
): Promise<Booking[]> {
  const bookings = await repos.bookings.listBySession(session.id);
  return bookings.filter(
    (booking) => booking.status === CONFIRMED_STATUS && !reminded.has(booking.id),
  );
}

function wantsReminders(member: Member | null): member is Member {
  return member !== null && !member.notificationsOptedOut;
}

export async function runClassReminders(
  repos: Repositories,
  options: RunClassRemindersOptions = {},
): Promise<ReminderRunResult> {
  const { studio } = await getStudioContext(repos);
  const from = options.now ?? new Date().toISOString();
  const to = new Date(new Date(from).getTime() + WINDOW_MS).toISOString();

  const sessions = (await repos.classSessions.listByStudio(studio.id, { from, to })).filter(
    (session) => session.status !== "cancelled",
  );
  const reminded = await remindedBookingIds(repos);

  let queued = 0;
  for (const session of sessions) {
    const seats = await seatsToRemind(repos, session, reminded);
    if (seats.length === 0) continue;
    const summary = await summaryOf(repos, session);
    for (const seat of seats) {
      const member = await repos.members.getById(seat.memberId);
      if (!wantsReminders(member)) continue;
      const recipient = { memberId: member.id, email: member.email, name: member.name };
      await enqueueNotification(repos, bookingReminder(recipient, summary, seat.id));
      reminded.add(seat.id);
      queued += 1;
    }
  }
  return { queued };
}
