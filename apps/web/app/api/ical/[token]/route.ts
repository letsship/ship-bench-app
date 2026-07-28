import { handle, notFound } from "@/lib/http";
import { listMemberUpcomingSessions } from "@/lib/services/classes";
import { resolveStudio } from "@/lib/services/context";
import { type CalendarEvent, toICalendar } from "@/lib/domain/ical";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/ical/[token] — a member's private iCalendar feed of their own
// upcoming booked sessions. Calendar clients can't send cookies, so the
// secret per-member token in the URL IS the authorization; unknown or empty
// tokens 404 without leaking any schedule data.
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { token } = await params;
    if (!token || token.trim().length === 0) return notFound("Calendar feed not found");
    const { repos, ctx } = await resolveStudio();
    const member = await repos.members.getByCalendarToken(token);
    if (!member) return notFound("Calendar feed not found");
    const sessions = await listMemberUpcomingSessions(
      repos,
      member.studioId,
      member.id,
      new Date().toISOString(),
    );
    const events: CalendarEvent[] = sessions.map((session) => ({
      uid: `${session.id}@studiobook`,
      title: session.classTypeName,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: ctx.studio.name,
    }));
    const body = toICalendar(events, {
      calendarName: `${ctx.studio.name} — ${member.name} classes`,
    });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="my-classes.ics"',
      },
    });
  });
}
