import { handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { buildMemberCalendarFeed } from "@/lib/services/calendar";

export const dynamic = "force-dynamic";

// GET /api/ical/[token] — a private iCalendar feed of the token-holder's
// upcoming booked sessions. No session cookie required — the secret token
// in the URL is the sole authorization. Unknown or empty tokens return 404.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const { token } = await params;
    const body = await buildMemberCalendarFeed(repos, ctx.studio.id, token);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="${encodeURIComponent(token)}.ics"`,
      },
    });
  });
}
