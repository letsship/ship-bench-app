import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { runBookingReminders } from "@/lib/services/reminders";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

// POST /api/reminders/run — queue 24-hour class reminders (idempotent).
export async function POST(_request: NextRequest): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const summary = await runBookingReminders(repos, ctx.studio.id);
    return ok(summary);
  });
}
