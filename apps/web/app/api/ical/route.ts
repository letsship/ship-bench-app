import { handle } from "@/lib/http";
import { listSessions } from "@/lib/services/classes";
import { resolveStudio } from "@/lib/services/context";
import { type CalendarEvent, toICalendar } from "@/lib/domain/ical";

export const dynamic = "force-dynamic";

// GET /api/ical — a public iCalendar feed of upcoming sessions, suitable for a
// calendar subscription. No auth: calendar clients can't send cookies.
export async function GET(): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const sessions = await listSessions(repos, ctx.studio.id, { from: new Date().toISOString() });
    const events: CalendarEvent[] = sessions.map((session) => ({
      uid: `${session.id}@studiobook`,
      title: session.classTypeName,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: ctx.studio.name,
    }));
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
