import { handle, ok } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { resolveStudio } from "@/lib/services/context";
import { runReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const summary = await runReminders(repos, ctx.studio.id, {
      now: () => new Date().toISOString(),
    });
    return ok(summary);
  });
}