import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { created, handle, HttpError, ok } from "@/lib/http";
import { listMemberPackages, purchasePackage } from "@/lib/services/class-packages";
import { resolveStudio } from "@/lib/services/context";
import { purchasePackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId= — a member's class packs, newest first.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const memberId = request.nextUrl.searchParams.get("memberId");
    if (!memberId) throw new HttpError(400, "bad_request", "memberId is required");
    const { repos } = await resolveStudio();
    return ok(await listMemberPackages(repos, memberId));
  });
}

// POST /api/packages — buy a class pack (5 or 10 credits) for a member.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = purchasePackageSchema.parse(await request.json());
    return created(await purchasePackage(repos, ctx.studio.id, input));
  });
}
