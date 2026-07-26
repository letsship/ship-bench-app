import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { created, handle, HttpError, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { createPack, listPacks } from "@/lib/services/packages";
import { createPackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId= — a member's class packs, newest first.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const memberId = request.nextUrl.searchParams.get("memberId");
    if (!memberId) {
      throw new HttpError(400, "bad_request", "memberId is required");
    }
    return ok(await listPacks(repos, memberId));
  });
}

// POST /api/packages — buy a class pack (5 or 10 credits).
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await createPack(repos, ctx.studio.id, input));
  });
}
