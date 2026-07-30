import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { runReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — cron-driven, idempotent 24-hour class reminder job.
// Requires a signed-in session like our other write endpoints. No request body:
// the cron just POSTs. Queues pending `booking_reminder` outbox rows (does not
// dispatch); dispatch happens later in dispatchOutbox. All async work is
// awaited before responding (Cloudflare Workers ends the request on return).
export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const summary = await runReminders(repos);
    return ok(summary);
  });
}
