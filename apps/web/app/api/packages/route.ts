import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { badRequest, created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { listMemberPackages, purchasePackage } from "@/lib/services/packages";
import { createPackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId= — a member's class packages, newest first.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const memberId = request.nextUrl.searchParams.get("memberId");
    if (!memberId) return badRequest("memberId is required");
    const { repos } = await resolveStudio();
    return ok(await listMemberPackages(repos, memberId));
  });
}

// POST /api/packages — buy a class pack of prepaid credits.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await purchasePackage(repos, input));
  });
}
