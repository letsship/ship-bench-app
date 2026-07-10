import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { listPackagesForMember, purchasePackage } from "@/lib/services/class-packages";
import { createPackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId= — a member's class packs, newest first.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const memberId = request.nextUrl.searchParams.get("memberId") ?? "";
    return ok(await listPackagesForMember(repos, ctx.studio.id, memberId));
  });
}

// POST /api/packages — buy a 5- or 10-credit class pack for a member.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await purchasePackage(repos, ctx.studio.id, input));
  });
}
