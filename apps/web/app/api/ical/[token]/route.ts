import { toICalendar } from "@/lib/domain/ical";
import { handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { getMemberCalendar } from "@/lib/services/member-calendar";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/ical/:token — one member's private iCalendar feed of their upcoming
// booked classes. Deliberately no requireSession(): a calendar client can't send
// our cookie, so the secret token in the URL is the authorization. An unknown or
// empty token 404s through handle() rather than leaking anyone's schedule.
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const { token } = await params;
    const { member, events } = await getMemberCalendar(repos, ctx.studio, token);
    const body = toICalendar(events, { calendarName: `${ctx.studio.name} — ${member.name}` });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="studiobook-my-classes.ics"',
      },
    });
  });
}
