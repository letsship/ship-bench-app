import { type CalendarEvent, toICalendar } from "@/lib/domain/ical";
import { handle } from "@/lib/http";
import { getMemberCalendar } from "@/lib/services/member-calendar";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const { token } = await params;
    const { repos, ctx } = await resolveStudio();
    const events: CalendarEvent[] = await getMemberCalendar(repos, ctx.studio, token);
    const body = toICalendar(events, { calendarName: `${ctx.studio.name} member schedule` });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="studiobook-calendar.ics"',
      },
    });
  });
}
