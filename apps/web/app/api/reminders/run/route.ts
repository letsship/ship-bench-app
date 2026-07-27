import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { runReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — queue booking reminders for all confirmed seats
// in sessions starting within the next 24 hours. Idempotent: safe to call
// repeatedly (e.g., from an hourly cron). Returns a summary of queued/skipped.
export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const summary = await runReminders(repos);
    return ok(summary);
  });
}
