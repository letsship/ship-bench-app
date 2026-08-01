import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { createNotificationProvider } from "@/lib/notifications/provider";
import { resolveStudio } from "@/lib/services/context";
import { runReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — queue booking reminders for classes starting within
// 24 hours. Idempotent, so a scheduler can hit it repeatedly.
export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    return ok(await runReminders(repos, createNotificationProvider()));
  });
}
