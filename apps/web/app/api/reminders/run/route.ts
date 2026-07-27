import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { runBookingReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — the scheduler's entrypoint: queue a reminder for
// every confirmed booking in a class starting within the next 24 hours. Safe to
// call repeatedly; the service dedupes against reminders it already queued.
export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const { queued } = await runBookingReminders(repos);
    return ok({ queued });
  });
}
