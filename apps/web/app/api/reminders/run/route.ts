import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { queueClassReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — queue class reminders for all members with confirmed
// bookings in sessions starting within the next 24 hours. Idempotent: calling it
// again does not duplicate reminders already queued.
export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    return ok(await queueClassReminders(repos, ctx.studio.id));
  });
}
