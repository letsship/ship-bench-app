import { requireSession } from "@/lib/auth/session";
import { ok, handle } from "@/lib/http";
import { queueClassReminders } from "@/lib/services/reminders";
import { resolveStudio } from "@/lib/services/context";
import { createNotificationProvider } from "@/lib/notifications/provider";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — queue 24-hour class reminders for booked members.
export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const result = await queueClassReminders(repos, createNotificationProvider(), ctx.studio.id);
    return ok(result);
  });
}
