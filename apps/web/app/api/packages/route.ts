import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { badRequest, created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { buyPackage, listPackages } from "@/lib/services/packages";
import { createPackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId= — the member's class packs, newest first.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const memberId = request.nextUrl.searchParams.get("memberId");
    if (!memberId) return badRequest("memberId is required");
    return ok(await listPackages(repos, memberId));
  });
}

// POST /api/packages — buy a class pack of 5 or 10 prepaid credits.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await buyPackage(repos, ctx.studio.id, input));
  });
}
