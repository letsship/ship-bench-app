import { notFound, handle } from "@/lib/http";
import { getMemberCalendarEvents } from "@/lib/services/calendar";
import { resolveStudio } from "@/lib/services/context";
import { toICalendar } from "@/lib/domain/ical";

export const dynamic = "force-dynamic";

// GET /api/ical/[token] — a member's private iCalendar feed of their own
// upcoming booked sessions. No auth: the secret per-member token in the URL is
// the authorization, so unknown tokens 404 and never leak a schedule.
export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const events = await getMemberCalendarEvents(repos, ctx.studio.id, params.token);
    if (!events) return notFound("Calendar not found");
    const body = toICalendar(events, { calendarName: `${ctx.studio.name} — my classes` });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="studiobook-my-classes.ics"',
      },
    });
  });
}
