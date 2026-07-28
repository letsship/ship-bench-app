import { handle } from "@/lib/http";
import { toICalendar, type CalendarEvent } from "@/lib/domain/ical";
import { resolveRepositories } from "@/lib/db/repos";
import { getMemberCalendarFeed } from "@/lib/services/calendar";

export const dynamic = "force-dynamic";

// GET /api/ical/[token] — a private, per-member iCalendar feed authorised
// solely by the secret token in the URL. No cookie/session required.
// An unknown or empty token returns 404 (never leaks member existence).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const { token } = await params;
    const repos = await resolveRepositories();
    const { events, memberName, studioName } = await getMemberCalendarFeed(repos, token);
    const body = toICalendar(events as CalendarEvent[], {
      calendarName: `${memberName} — ${studioName} schedule`,
    });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="${encodeURIComponent(memberName)}-classes.ics"`,
      },
    });
  });
}