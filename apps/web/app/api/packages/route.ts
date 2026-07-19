import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { buyClassPack, listClassPacks } from "@/lib/services/class-packs";
import { resolveStudio } from "@/lib/services/context";
import { createPackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId=<id> — member's class packs, newest first.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const memberId = request.nextUrl.searchParams.get("memberId") ?? "";
    return ok(await listClassPacks(repos, memberId));
  });
}

// POST /api/packages — buy a class pack (5 or 10 credits).
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await buyClassPack(repos, input));
  });
}
