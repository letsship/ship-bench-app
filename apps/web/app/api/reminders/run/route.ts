import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { runClassReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — the scheduler's day-before reminder job. Safe to
// call repeatedly: already-reminded bookings are skipped, so an hourly cron
// still queues exactly one reminder per confirmed seat.
export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    return ok(await runClassReminders(repos));
  });
}
