import { handle } from "@/lib/http";
import { toICalendar } from "@/lib/domain/ical";
import { resolveStudio } from "@/lib/services/context";
import { getMemberCalendarByToken } from "@/lib/services/member-calendar";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/ical/[token] — a private iCalendar feed of ONLY the token-holder's
// upcoming booked sessions. No session cookie is required: the secret token in
// the URL is the authorization. An unknown or empty token yields 404 so a
// guessed/made-up token never leaks another member's schedule.
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const { token } = await params;
    const result = await getMemberCalendarByToken(repos, ctx.studio.name, token);
    if (!result) {
      return new Response("Not found", { status: 404 });
    }
    const body = toICalendar(result.events, {
      calendarName: `${ctx.studio.name} — ${result.member.name}`,
    });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="member-${result.member.id}.ics"`,
      },
    });
  });
}
