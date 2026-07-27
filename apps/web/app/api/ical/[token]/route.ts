import { handle, notFound } from "@/lib/http";
import { buildMemberCalendarFeed } from "@/lib/services/member-calendar";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

// GET /api/ical/:token — a private per-member iCalendar feed of only that
// member's upcoming booked sessions. No auth: calendar clients can't send
// cookies, so the secret token itself is the authorization. An unknown or
// empty token 404s rather than leaking whether it was almost valid.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const { token } = await params;
    const body = await buildMemberCalendarFeed(repos, token);
    if (body === null) return notFound();
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="my-classes.ics"',
      },
    });
  });
}
