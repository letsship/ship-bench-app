import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { listPublicRoster } from "@/lib/services/public-roster";
import { publicRosterQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/public/roster?sessionIds=a,b — the class roster a studio embeds on its
// own website. Public by design: no session is required, because the embed runs
// on the studio's marketing site where no visitor is signed in. Because the
// caller is anonymous, `sessionIds` is parsed and length-capped here, and the
// service returns only the anonymised fields `PublicAttendee` declares.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const { sessionIds } = publicRosterQuerySchema.parse({
      sessionIds: request.nextUrl.searchParams.get("sessionIds") ?? undefined,
    });
    return ok(await listPublicRoster(repos, ctx.studio.id, sessionIds));
  });
}
