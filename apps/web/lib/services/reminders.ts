import { reminderDedupKey, reminderWindow } from "@/lib/domain/reminders";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassSession, Member } from "@/lib/db/types";
import { bookingReminder } from "@/lib/notifications/messages";
import { enqueueNotification, shouldSend } from "@/lib/notifications/outbox";
import type { StudioContext } from "./studio";

export interface RemindersSummary {
  queued: number;
}

export interface RunRemindersOptions {
  now?: Date;
}

const isConfirmed = (booking: Booking): boolean => booking.status === "booked";

function recipientFor(member: Member) {
  return { memberId: member.id, email: member.email, name: member.name };
}

// Queue one `booking_reminder` outbox row per confirmed booking in a session
// starting within the next 24 hours. Idempotent: bookings that already have a
// reminder queued (matched by dedup key) are skipped, so the job is safe to
// run repeatedly. Opt-outs are honoured at queue time.
export async function runReminders(
  repos: Repositories,
  ctx: StudioContext,
  options: RunRemindersOptions = {},
): Promise<RemindersSummary> {
  const window = reminderWindow(options.now ?? new Date());
  const sessions = await repos.classSessions.listByStudio(ctx.studio.id, window);
  const bookings = (await repos.bookings.listBySessionIds(sessions.map((s) => s.id))).filter(
    isConfirmed,
  );

  const queued = await repos.outbox.listByKind("booking_reminder");
  const queuedKeys = new Set(queued.map((row) => row.dedupKey).filter(Boolean));
  const sessionById = new Map<string, ClassSession>(sessions.map((s) => [s.id, s]));

  let count = 0;
  for (const booking of bookings) {
    const dedupKey = reminderDedupKey(booking.id);
    if (queuedKeys.has(dedupKey)) continue;
    const member = await repos.members.getById(booking.memberId);
    const session = sessionById.get(booking.sessionId);
    if (!member || !session) continue;
    if (
      !shouldSend("booking_reminder", {
        memberOptedOut: member.notificationsOptedOut,
        ...ctx.settings,
      })
    ) {
      continue;
    }
    const classType = await repos.classTypes.getById(session.classTypeId);
    await enqueueNotification(
      repos,
      bookingReminder(recipientFor(member), {
        title: classType?.name ?? "Class",
        startsAt: session.startsAt,
        instructor: session.instructor,
      }),
      dedupKey,
    );
    queuedKeys.add(dedupKey);
    count += 1;
  }
  return { queued: count };
}
