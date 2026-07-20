import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { createPackage, listPackages } from "@/lib/services/packages";
import { resolveStudio } from "@/lib/services/context";
import { createPackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages — list packages for a member
export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const memberId = new URL(request.url).searchParams.get("memberId");
    if (!memberId) {
      return new Response(JSON.stringify({ error: "memberId is required" }), { status: 400 });
    }
    return ok(await listPackages(repos, memberId));
  });
}

// POST /api/packages — buy a package
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await createPackage(repos, ctx.studio.id, input));
  });
}
