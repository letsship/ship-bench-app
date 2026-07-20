import { handle } from "@/lib/http";
import { buildMemberCalendar } from "@/lib/services/member-calendar";
import { toICalendar } from "@/lib/domain/ical";
import { resolveRepositories } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

// GET /api/ical/[token] — a private per-member iCalendar feed of that member's
// upcoming booked sessions. Authorization is purely the secret token in the URL.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const { token } = await params;
    const repos = await resolveRepositories();
    const { events, calendarName } = await buildMemberCalendar(repos, token);
    const body = toICalendar(events, { calendarName });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="studiobook.ics"',
      },
    });
  });
}
