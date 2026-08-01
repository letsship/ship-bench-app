import { resolveRepositories } from "@/lib/db/repos";
import { toICalendar } from "@/lib/domain/ical";
import { HttpError, handle } from "@/lib/http";
import { buildMemberCalendarFeed } from "@/lib/services/member-calendar";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/ical/:token — a private per-member iCalendar feed of the member's
// upcoming booked sessions. Calendar clients can't send our session cookie, so
// the unguessable token in the URL is the sole authorization; a blank or
// unknown token 404s without leaking whether it was close.
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { token } = await params;
    const repos = await resolveRepositories();
    const feed = await buildMemberCalendarFeed(repos, token ?? "", new Date().toISOString());
    if (!feed) throw new HttpError(404, "not_found", "Calendar not found");
    const body = toICalendar(feed.events, { calendarName: `${feed.member.name} — classes` });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="studiobook-${feed.member.id}.ics"`,
      },
    });
  });
}
