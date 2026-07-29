import { handle, HttpError } from "@/lib/http";
import { resolveRepositories } from "@/lib/db/repos";
import { toICalendar } from "@/lib/domain/ical";
import { getMemberCalendarEvents } from "@/lib/services/member-calendar";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/ical/[token] — a private, cookieless iCalendar feed of the
// token-holder's upcoming booked sessions. The secret token in the URL is the
// authorization (calendar clients can't send our cookie), so an unknown or
// empty token must 404 and never leak someone else's schedule.
export async function GET(_req: Request, ctx: RouteContext): Promise<Response> {
  return handle(async () => {
    const { token } = await ctx.params;
    const repos = await resolveRepositories();
    const feed = await getMemberCalendarEvents(repos, token);
    if (!feed) throw new HttpError(404, "not_found", "Calendar not found");
    const body = toICalendar(feed.events, {
      calendarName: `${feed.member.name} — Studiobook classes`,
    });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="studiobook.ics"',
      },
    });
  });
}
