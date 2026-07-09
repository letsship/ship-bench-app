import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { badRequest, handle, ok } from "@/lib/http";
import { getMemberStatement } from "@/lib/services/account-statements";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

// GET /api/statements?memberId= — a member's account statement.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const memberId = request.nextUrl.searchParams.get("memberId");
    if (!memberId) return badRequest("memberId is required");
    return ok(await getMemberStatement(repos, ctx.studio.id, memberId));
  });
}
