import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { runReminders } from "@/lib/services/reminders";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — queue a booking_reminder for every confirmed
// booking in a class session starting within the next 24 hours. Safe to call
// repeatedly (e.g. an hourly cron): already-reminded bookings are skipped.
export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    return ok(await runReminders(repos));
  });
}
