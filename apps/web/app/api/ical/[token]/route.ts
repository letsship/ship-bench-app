import { handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { getMemberCalendar } from "@/lib/services/calendar";
import { toICalendar } from "@/lib/domain/ical";

export const dynamic = "force-dynamic";

// GET /api/ical/[token] — a PRIVATE iCalendar feed of only the token-holder's
// upcoming, confirmed-seat sessions. No session cookie is required: the secret
// token in the URL is the authorization (calendar clients can't send cookies),
// so an unknown or empty token must 404 rather than leak anyone's schedule.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const { token } = await params;
    const { repos } = await resolveStudio();
    const { member, events } = await getMemberCalendar(repos, token);
    const body = toICalendar(events, { calendarName: `${member.name} classes` });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="member-${member.id}.ics"`,
      },
    });
  });
}
