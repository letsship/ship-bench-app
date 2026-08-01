import { HttpError, handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { listMemberUpcomingEvents, resolveMemberByToken } from "@/lib/services/member-calendar";
import { toICalendar } from "@/lib/domain/ical";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/ical/:token — a member's private iCalendar feed of their upcoming
// booked sessions. No requireSession: calendar clients can't send cookies, so
// the secret token is the authorization; an empty or unknown token 404s.
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const { token } = await params;
    const member = await resolveMemberByToken(repos, ctx.studio.id, token);
    if (!member) throw new HttpError(404, "not_found", "Calendar not found");
    const events = await listMemberUpcomingEvents(repos, member, {
      now: new Date().toISOString(),
      location: ctx.studio.name,
    });
    const body = toICalendar(events, {
      calendarName: `${ctx.studio.name} — ${member.name}`,
    });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="studiobook-member.ics"',
      },
    });
  });
}
