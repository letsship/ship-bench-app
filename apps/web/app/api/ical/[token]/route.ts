import { HttpError, handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { listMemberCalendarEvents } from "@/lib/services/member-calendar";
import { toICalendar } from "@/lib/domain/ical";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/ical/[token] — a private, per-member iCalendar feed of the token
// holder's own upcoming booked sessions. Calendar apps can't send our session
// cookie, so the secret token in the URL is the sole authorization: an
// unknown or empty token 404s rather than revealing anyone's schedule.
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const { token } = await params;
    const member = token ? await repos.members.findByCalendarToken(token) : null;
    if (!member) throw new HttpError(404, "not_found", "Not found");
    const events = await listMemberCalendarEvents(repos, member);
    const body = toICalendar(events, { calendarName: `${ctx.studio.name} — ${member.name}` });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="studiobook.ics"',
      },
    });
  });
}
