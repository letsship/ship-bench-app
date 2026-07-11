import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { listClassPackages, purchaseClassPackage } from "@/lib/services/class-packages";
import { resolveStudio } from "@/lib/services/context";
import { createClassPackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId= — a member's class packs, newest first.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const memberId = request.nextUrl.searchParams.get("memberId") ?? "";
    return ok(await listClassPackages(repos, memberId));
  });
}

// POST /api/packages — buy a 5- or 10-credit class pack for a member.
export async function POST(request: NextRequest): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const input = createClassPackageSchema.parse(await request.json());
    return created(await purchaseClassPackage(repos, input));
  });
}
