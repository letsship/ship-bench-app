import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { created, handle, HttpError, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { listClassPackages, purchaseClassPackage } from "@/lib/services/class-packages";
import { createClassPackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId=<id> — a member's class packages, newest first.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const memberId = request.nextUrl.searchParams.get("memberId");
    if (!memberId) throw new HttpError(400, "bad_request", "memberId is required");
    return ok(await listClassPackages(repos, memberId));
  });
}

// POST /api/packages — buy a class pack (5 or 10 credits) for a member.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createClassPackageSchema.parse(await request.json());
    return created(await purchaseClassPackage(repos, ctx.studio.id, input));
  });
}
