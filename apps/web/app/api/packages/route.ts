import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { buyPack, listMemberPacks } from "@/lib/services/packs";
import { buyPackSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId=<id> — member's packs, newest first.
export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId");
    if (!memberId) {
      throw new Error("memberId is required");
    }
    const { repos } = await resolveStudio();
    return ok(await listMemberPacks(repos, memberId));
  });
}

// POST /api/packages — buy a pack (5 or 10 credits).
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = buyPackSchema.parse(await request.json());
    return created(await buyPack(repos, ctx.studio.id, input));
  });
}
