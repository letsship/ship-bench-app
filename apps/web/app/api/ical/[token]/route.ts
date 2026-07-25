import { handle } from "@/lib/http";
import { getMemberCalendarEvents } from "@/lib/services/member-calendar";
import { resolveStudio } from "@/lib/services/context";
import { toICalendar } from "@/lib/domain/ical";

export const dynamic = "force-dynamic";

// GET /api/ical/[token] — a private per-member iCalendar feed of upcoming booked sessions.
// The secret token is the authorization; no session cookie required. Unknown or empty token 404s
// without leaking another member's schedule.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const { token } = await params;
    const events = await getMemberCalendarEvents(repos, token);

    // Add studio name to location (service used studioId as placeholder).
    for (const event of events) {
      event.location = ctx.studio.name;
    }

    const body = toICalendar(events, { calendarName: `${ctx.studio.name} schedule` });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="studiobook.ics"',
      },
    });
  });
}
