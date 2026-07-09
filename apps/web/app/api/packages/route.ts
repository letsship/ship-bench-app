import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { createPackage, listPackages } from "@/lib/services/packages";
import { createPackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId= — a member's class packs, newest first.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const memberId = request.nextUrl.searchParams.get("memberId") ?? "";
    return ok(await listPackages(repos, memberId));
  });
}

// POST /api/packages — sell a member a 5- or 10-credit class pack.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await createPackage(repos, input));
  });
}
