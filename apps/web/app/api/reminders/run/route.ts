import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { runReminders } from "@/lib/services/reminders";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const summary = await runReminders(repos, ctx.studio.id, {
      now: () => new Date().toISOString(),
    });
    return ok(summary);
  });
}
