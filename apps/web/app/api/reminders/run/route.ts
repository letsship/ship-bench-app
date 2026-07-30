import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { runReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — scheduler entry point. Queues a booking_reminder
// for every confirmed seat in a session starting within the next 24 hours.
// Takes no body and is idempotent, so an hourly cron is safe.
export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    return ok(await runReminders(repos));
  });
}
