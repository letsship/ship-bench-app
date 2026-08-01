import { requireSession } from "@/lib/auth/session";
import { created, handle, HttpError, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { createPack, listPacksByMember } from "@/lib/services/packs";
import { createPackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId=<id> — a member's class packs, newest first.
export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const memberId = new URL(request.url).searchParams.get("memberId");
    if (!memberId) throw new HttpError(400, "bad_request", "memberId is required");
    return ok(await listPacksByMember(repos, memberId));
  });
}

// POST /api/packages — sell a prepaid class pack (5 or 10 credits).
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await createPack(repos, ctx.studio.id, input));
  });
}
