import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { listPublicRoster } from "@/lib/services/public-roster";
import { publicRosterQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/public/roster?sessionIds=a,b — the class roster a studio embeds on its
// own website. Public by design: no session is required, because the embed runs
// on the studio's marketing site where no visitor is signed in.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const raw = request.nextUrl.searchParams.get("sessionIds");
    const query = publicRosterQuerySchema.parse({ sessionIds: raw ?? undefined });
    return ok(await listPublicRoster(repos, ctx.studio.id, query.sessionIds));
  });
}
