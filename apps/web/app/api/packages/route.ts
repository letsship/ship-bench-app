import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { createPack, listPacks } from "@/lib/services/packs";
import { createPackageSchema, listPackagesQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const { memberId } = listPackagesQuerySchema.parse({
      memberId: request.nextUrl.searchParams.get("memberId") ?? undefined,
    });
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
