import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { HttpError } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { createPack, listPacks } from "@/lib/services/packs";
import { createPackSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages — list a member's packs, newest first.
export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId");
    if (!memberId) throw new HttpError(400, "bad_request", "memberId query parameter required");
    return ok(await listPacks(repos, memberId));
  });
}

// POST /api/packages — create a new pack.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createPackSchema.parse(await request.json());
    return created(await createPack(repos, ctx.studio.id, input));
  });
}
