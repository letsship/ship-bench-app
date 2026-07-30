import { type CalendarEvent, toICalendar } from "@/lib/domain/ical";
import { handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { memberCalendarEvents } from "@/lib/services/member-calendar";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/ical/:token — one member's private feed of their upcoming booked
// classes, for a phone calendar subscription. Deliberately no requireSession():
// a calendar client can't send our cookie, so the secret token IS the
// authorization. An unknown token 404s through the shared error envelope.
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const { token } = await params;
    const events: CalendarEvent[] = await memberCalendarEvents(repos, ctx, token);
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
