import { resolveRepositories } from "@/lib/db/repos";
import { handle, notFound } from "@/lib/http";
import { memberCalendarFeed } from "@/lib/services/calendar";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { token } = await params;
    const repos = await resolveRepositories();
    const body = await memberCalendarFeed(repos, token);
    if (body === null) return notFound("Calendar subscription not found");

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="studiobook-member.ics"',
      },
    });
  });
}
