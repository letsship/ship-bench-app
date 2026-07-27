import { handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { buildMemberCalendarEvents } from "@/lib/services/member-calendar";
import { toICalendar } from "@/lib/domain/ical";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/ical/[token] — a private iCalendar feed of one member's upcoming
// booked sessions. No auth: calendar clients can't send cookies, so the
// unguessable token in the URL is the sole authorization. An unknown or empty
// token 404s via the service.
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const { token } = await params;
    const events = await buildMemberCalendarEvents(repos, ctx.studio.name, token);
    const body = toICalendar(events, { calendarName: `${ctx.studio.name} — my classes` });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="studiobook.ics"',
      },
    });
  });
}
