import { requireSession } from "@/lib/auth/session";
import { badRequest, created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { createPack, listPacks } from "@/lib/services/packs";
import { createPackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const memberId = new URL(request.url).searchParams.get("memberId");
    if (!memberId) {
      return badRequest("memberId is required");
    }
    const { repos } = await resolveStudio();
    return ok(await listPacks(repos, memberId));
  });
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await createPack(repos, ctx.studio.id, input));
  });
}
