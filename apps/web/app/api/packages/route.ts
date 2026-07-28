import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { badRequest, created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { buyPack, listPacks } from "@/lib/services/packs";
import { createPackSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId= — a member's packs, newest first.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const memberId = request.nextUrl.searchParams.get("memberId");
    if (!memberId) return badRequest("memberId query parameter is required");
    return ok(await listPacks(repos, memberId));
  });
}

// POST /api/packages — sell a 5- or 10-credit class pack to a member.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createPackSchema.parse(await request.json());
    return created(await buyPack(repos, ctx.studio.id, input));
  });
}
