import { handle } from "@/lib/http";
import { buildMemberCalendar } from "@/lib/services/ical";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

// GET /api/ical/[token] — a private iCalendar feed of a member's upcoming booked
// sessions. Authorized by secret token in the URL (no session cookie required).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const { token } = await params;
    const body = await buildMemberCalendar(repos, ctx.studio, token);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="studiobook.ics"',
      },
    });
  });
}
