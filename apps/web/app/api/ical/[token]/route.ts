import { handle } from "@/lib/http";
import { getMemberCalendarFeed } from "@/lib/services/members";
import { resolveStudio } from "@/lib/services/context";
import { toICalendar } from "@/lib/domain/ical";

export const dynamic = "force-dynamic";

// GET /api/ical/[token] — a private per-member iCalendar feed. The secret token
// (in the URL) is the authorization — calendar clients can't send session cookies,
// so the token itself grants access. Unknown tokens return 404, never leak
// anyone's schedule.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const { token } = await params;
    const { member, events } = await getMemberCalendarFeed(repos, token);
    const body = toICalendar(events, { calendarName: `${member.name} — my classes` });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="${member.name.replace(/\s+/g, "_")}.ics"`,
      },
    });
  });
}
