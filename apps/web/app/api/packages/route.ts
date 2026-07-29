import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { buyPackage, listPackages } from "@/lib/services/packages";
import { createPackageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/packages?memberId=<id> — list a member's packs, newest first.
export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");
    if (!memberId) {
      return new Response(JSON.stringify({ error: { code: "bad_request", message: "memberId is required" } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    return ok(await listPackages(repos, memberId));
  });
}

// POST /api/packages — buy a class pack.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await buyPackage(repos, input));
  });
}