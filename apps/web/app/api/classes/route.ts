import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { createSession, listSessions } from "@/lib/services/classes";
import { resolveStudio } from "@/lib/services/context";
import { createSessionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/classes?from=&to= — scheduled class sessions with live occupancy.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const from = request.nextUrl.searchParams.get("from") ?? undefined;
    const to = request.nextUrl.searchParams.get("to") ?? undefined;
    return ok(await listSessions(repos, ctx.studio.id, { from, to }));
  });
}

// POST /api/classes — schedule a new class session.
export async function POST(request: NextRequest): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createSessionSchema.parse(await request.json());
    return created(await createSession(repos, ctx.studio.id, input));
  });
}
