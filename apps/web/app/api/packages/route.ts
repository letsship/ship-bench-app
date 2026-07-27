import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { createPackage, listPackages } from "@/lib/services/packages";
import { createPackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId=<id> — packages for a member, newest first.
export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId");
    if (!memberId) {
      return ok([]);
    }
    return ok(await listPackages(repos, memberId));
  });
}

// POST /api/packages — buy a class pack.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await createPackage(repos, ctx.studio.id, input));
  });
}
