import { handle } from "@/lib/http";
import { listMemberBookedSessions } from "@/lib/services/classes";
import { type CalendarEvent, toICalendar } from "@/lib/domain/ical";
import { resolveRepositories } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

// GET /api/ical/[token] — a private iCalendar feed of upcoming sessions that the
// token-holder is booked into. No auth: calendar clients can't send cookies, so
// the secret token itself is the authorization. Unknown or empty tokens return 404.
export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
): Promise<Response> {
  return handle(async () => {
    const token = params.token?.trim();
    if (!token) {
      return new Response(null, { status: 404 });
    }

    const repos = await resolveRepositories();
    const member = await repos.members.findByCalendarToken(token);
    if (!member) {
      return new Response(null, { status: 404 });
    }

    const studio = await repos.studios.getFirst();
    if (!studio || studio.id !== member.studioId) {
      return new Response(null, { status: 404 });
    }

    const sessions = await listMemberBookedSessions(repos, studio.id, member.id, {
      from: new Date().toISOString(),
    });

    const events: CalendarEvent[] = sessions.map((session) => ({
      uid: `${session.id}@studiobook`,
      title: session.classTypeName,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      description: `Instructor: ${session.instructor}`,
      location: studio.name,
    }));

    const body = toICalendar(events, { calendarName: `${studio.name} — Your Classes` });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="${member.name.replace(/[^a-z0-9]/gi, "_")}.ics"`,
      },
    });
  });
}
