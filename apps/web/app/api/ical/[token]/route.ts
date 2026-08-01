import { toICalendar } from "@/lib/domain/ical";
import { handle, HttpError } from "@/lib/http";
import { memberCalendarEvents } from "@/lib/services/calendar";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

// GET /api/ical/:token — a private iCalendar subscription for one member.
// The unguessable token authorizes access because calendar clients send no cookie.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const [{ repos, ctx }, { token }] = await Promise.all([resolveStudio(), params]);
    const events = await memberCalendarEvents(repos, ctx.studio.id, token, new Date());
    if (!events) throw new HttpError(404, "not_found", "Calendar subscription not found");

    const body = toICalendar(events, {
      calendarName: `${ctx.studio.name} classes`,
    });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="studiobook.ics"',
      },
    });
  });
}
