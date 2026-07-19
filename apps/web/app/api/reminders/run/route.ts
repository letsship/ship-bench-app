import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { runReminders } from "@/lib/services/reminders";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    return ok(await runReminders(repos));
  });
}
