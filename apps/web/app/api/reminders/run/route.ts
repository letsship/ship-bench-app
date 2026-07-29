import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { runReminders } from "@/lib/services/reminders";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — scheduler-driven (cron) job that queues a
// `booking_reminder` notification for every member with a confirmed seat in a
// class starting within the next 24 hours. Idempotent: a repeat run never
// re-queues a booking that already has a reminder. Enqueues only — delivery is
// handled by the outbox dispatcher. Requires a signed-in session like our other
// write endpoints.
export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const summary = await runReminders(repos, ctx.studio.id);
    return ok(summary);
  });
}
