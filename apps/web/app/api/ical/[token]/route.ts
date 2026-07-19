import { handle } from "@/lib/http";
import { getMemberCalendarByToken } from "@/lib/services/calendar";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/ical/[token] — a member's private calendar feed authorized by token.
// No session cookie required; the token in the URL is the authorization.
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const { token } = await params;
    const body = await getMemberCalendarByToken(repos, ctx.studio.id, token);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="schedule.ics"',
      },
    });
  });
}
