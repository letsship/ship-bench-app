import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { runReminders } from "@/lib/services/reminders";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — queue 24-hour reminders for upcoming classes.
// Requires an authenticated session. Idempotent: safe to run repeatedly.
export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const result = await runReminders(repos);
    return ok(result);
  });
}
