import { resolveRepositories } from "@/lib/db/repos";
import { toICalendar } from "@/lib/domain/ical";
import { handle, notFound } from "@/lib/http";
import { getMemberCalendarEvents } from "@/lib/services/calendar";

export const dynamic = "force-dynamic";

// GET /api/ical/[token] — a private per-member iCalendar feed of that member's
// own upcoming booked sessions. The token in the path is the sole
// authorization (calendar clients can't send our session cookie); an unknown
// or empty token 404s rather than leaking whether it ever existed.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const { token } = await params;
    if (!token || !token.trim()) return notFound();

    const repos = await resolveRepositories();
    const events = await getMemberCalendarEvents(repos, token, new Date());
    if (!events) return notFound();

    const body = toICalendar(events, { calendarName: "My classes" });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="my-classes.ics"',
      },
    });
  });
}
