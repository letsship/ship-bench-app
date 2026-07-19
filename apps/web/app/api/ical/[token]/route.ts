import { handle } from "@/lib/http";
import { getMemberCalendarFeed } from "@/lib/services/member-calendar";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

// GET /api/ical/[token] — a private iCalendar feed of upcoming booked sessions
// for a member, identified by a per-member secret token. No session cookie
// required — the token alone authorizes access to that member's calendar.
// An unknown or empty token returns 404.
export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const params = await props.params;
    const { repos, ctx } = await resolveStudio();
    const body = await getMemberCalendarFeed(repos, ctx, params.token, new Date());
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="calendar.ics"',
      },
    });
  });
}
