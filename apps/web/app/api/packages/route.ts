import { requireSession } from "@/lib/auth/session";
import { HttpError, created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { createPackage, listPackages } from "@/lib/services/packages";
import { createPackageSchema } from "@/lib/validation";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId=:id — a member's packs, newest first.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const memberId = request.nextUrl.searchParams.get("memberId");
    if (!memberId) throw new HttpError(400, "bad_request", "memberId is required");
    const { repos } = await resolveStudio();
    return ok(await listPackages(repos, memberId));
  });
}

// POST /api/packages — buy a five- or ten-credit pack.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await createPackage(repos, ctx.studio.id, input));
  });
}
