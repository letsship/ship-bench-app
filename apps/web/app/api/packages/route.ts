import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { buyPackage, listPackages } from "@/lib/services/packages";
import { createPackageSchema, listPackagesSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type GetParams = { searchParams: Promise<Record<string, string>> };

// GET /api/packages?memberId=<id> — member's packages, newest first
export async function GET(_request: Request, { searchParams }: GetParams): Promise<Response> {
  return handle(async () => {
    const params = await searchParams;
    const { memberId } = listPackagesSchema.parse(params);
    const { repos } = await resolveStudio();
    return ok(await listPackages(repos, memberId));
  });
}

// POST /api/packages — buy a new pack
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createPackageSchema.parse(await request.json());
    return created(await buyPackage(repos, ctx.studio.id, input));
  });
}
