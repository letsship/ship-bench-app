import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { runReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — queue a booking_reminder for every confirmed seat
// in a class session starting within the next 24 hours. Safe to call
// repeatedly (e.g. from an hourly cron): already-queued reminders are skipped.
export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    return ok(await runReminders(repos, ctx.studio.id));
  });
}
