import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { createPackage, listPackages } from "@/lib/services/packages";
import { resolveStudio } from "@/lib/services/context";
import { createPackageSchema, listPackagesQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId=<id> — list a member's packs, newest first.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const memberId = request.nextUrl.searchParams.get("memberId");
    const { memberId: validatedMemberId } = listPackagesQuerySchema.parse({ memberId });
    return ok(await listPackages(repos, validatedMemberId));
  });
}

// POST /api/packages — create a new pack for a member.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await createPackage(repos, ctx.studio.id, input));
  });
}
