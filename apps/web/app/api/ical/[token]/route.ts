import { type CalendarEvent, toICalendar } from "@/lib/domain/ical";
import { HttpError, handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { listUpcomingBookedSessions } from "@/lib/services/member-calendar";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/ical/[token] — a member's private iCalendar feed of only their own
// upcoming booked sessions. The secret token in the URL is the ONLY
// authorization (calendar clients can't send cookies), so there is no session
// check; an empty or unknown token must 404 without leaking anything.
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { token } = await params;
    if (!token) throw new HttpError(404, "not_found", "Not found");
    const { repos, ctx } = await resolveStudio();
    const member = await repos.members.getByIcalToken(token);
    if (!member) throw new HttpError(404, "not_found", "Not found");
    const sessions = await listUpcomingBookedSessions(repos, member.id, new Date().toISOString());
    const events: CalendarEvent[] = sessions.map((session) => ({
      uid: `${session.sessionId}@studiobook`,
      title: session.title,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: ctx.studio.name,
    }));
    const body = toICalendar(events, {
      calendarName: `${member.name} — ${ctx.studio.name}`,
    });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="studiobook-my-classes.ics"',
      },
    });
  });
}
