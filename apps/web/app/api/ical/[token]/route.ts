import { toICalendar } from "@/lib/domain/ical";
import { handle } from "@/lib/http";
import { getMemberCalendar } from "@/lib/services/calendar";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/ical/[token] — a private per-member iCalendar feed of that
// member's upcoming booked sessions. No session cookie: a calendar app can't
// send one, so the token in the path is the sole authorization. An unknown or
// empty token 404s rather than leaking anyone's schedule.
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const { token } = await params;
    const { member, events } = await getMemberCalendar(repos, token);
    const body = toICalendar(events, { calendarName: `${member.name}'s schedule` });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="studiobook.ics"',
      },
    });
  });
}
