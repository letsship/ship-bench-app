import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import type { ClassPack } from "@/lib/db/types";
import { HttpError, created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { createPackage, listPackages } from "@/lib/services/packages";
import { createPackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// The list view of a pack: everything except the member it belongs to (the
// caller already filtered by member).
const packView = (pack: ClassPack) => ({
  id: pack.id,
  creditsTotal: pack.creditsTotal,
  creditsRemaining: pack.creditsRemaining,
  priceCents: pack.priceCents,
  status: pack.status,
  purchasedAt: pack.purchasedAt,
});

// GET /api/packages?memberId= — that member's packs, newest first.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const memberId = request.nextUrl.searchParams.get("memberId");
    if (!memberId) throw new HttpError(400, "bad_request", "memberId is required");
    return ok((await listPackages(repos, memberId)).map(packView));
  });
}

// POST /api/packages — sell a member a 5- or 10-credit pack.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    const pack = await createPackage(repos, input);
    return created({ memberId: pack.memberId, ...packView(pack) });
  });
}
