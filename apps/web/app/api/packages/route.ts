import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { listPackages, purchasePackage } from "@/lib/services/packages";
import { createPackageSchema, listPackagesQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId=<id> — a member's class packs, newest first.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const { memberId } = listPackagesQuerySchema.parse({
      memberId: request.nextUrl.searchParams.get("memberId"),
    });
    return ok(await listPackages(repos, memberId));
  });
}

// POST /api/packages — buy a class pack (5 or 10 credits) for a member.
export async function POST(request: NextRequest): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await purchasePackage(repos, ctx.studio.id, input));
  });
}
