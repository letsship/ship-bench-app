import { requireSession } from "@/lib/auth/session";
import { HttpError, created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { buyPack, listPacks } from "@/lib/services/packs";
import { createPackSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId=<id> — a member's class packs, newest first.
export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const memberId = new URL(request.url).searchParams.get("memberId");
    if (!memberId) throw new HttpError(400, "bad_request", "memberId is required");
    return ok(await listPacks(repos, memberId));
  });
}

// POST /api/packages — buy a 5- or 10-credit class pack for a member.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createPackSchema.parse(await request.json());
    return created(await buyPack(repos, ctx.studio.id, input));
  });
}
