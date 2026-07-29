import { handle, HttpError } from "@/lib/http";
import { listMemberUpcomingSessions } from "@/lib/services/classes";
import { resolveStudio } from "@/lib/services/context";
import { type CalendarEvent, toICalendar } from "@/lib/domain/ical";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const { token } = await params;
    if (!token || !token.trim()) {
      throw new HttpError(404, "not_found", "Calendar not found");
    }
    const member = await repos.members.findByCalendarToken(token.trim());
    if (!member) {
      throw new HttpError(404, "not_found", "Calendar not found");
    }
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? new Date().toISOString();
    const sessions = await listMemberUpcomingSessions(
      repos,
      ctx.studio.id,
      member.id,
      from,
    );
    const events: CalendarEvent[] = sessions.map((session) => ({
      uid: `${session.id}@studiobook`,
      title: session.classTypeName,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: ctx.studio.name,
    }));
    const body = toICalendar(events, { calendarName: `${member.name}'s schedule` });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="my-schedule.ics"',
      },
    });
  });
}