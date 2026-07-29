import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { runReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — queue a 24-hour booking_reminder for every
// confirmed seat in a session starting within the next day. Idempotent: the
// scheduler may call this repeatedly and each booking is reminded at most once.
export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    return ok(await runReminders(repos));
  });
}
