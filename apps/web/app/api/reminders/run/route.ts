import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { runReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — queue a booking_reminder for every confirmed seat
// in a class starting within the next 24 hours. Idempotent, so a scheduler can
// hit it hourly; delivery happens via the outbox dispatcher.
export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    return ok(await runReminders(repos, ctx.studio.id));
  });
}
