import { requireSession } from "@/lib/auth/session";
import { ok, handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { runReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — queue 24-hour class reminders for confirmed
// bookings. Safe to call repeatedly: a booking that already has a queued (or
// sent) booking_reminder will be skipped.
export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const queued = await runReminders(repos, ctx.studio.id);
    return ok({ queued });
  });
}