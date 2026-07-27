import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { badRequest, created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { createPackage, listMemberPackages } from "@/lib/services/class-packs";
import { createPackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId=<id> — a member's class packs, newest first.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const memberId = request.nextUrl.searchParams.get("memberId");
    if (!memberId) return badRequest("memberId is required");
    const { repos } = await resolveStudio();
    return ok(await listMemberPackages(repos, memberId));
  });
}

// POST /api/packages — buy a class pack (5 or 10 credits).
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await createPackage(repos, ctx.studio.id, input));
  });
}
