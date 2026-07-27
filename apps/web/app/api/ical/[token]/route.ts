import { handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { getMemberCalendarFeed } from "@/lib/services/calendar";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const { token } = await params;
    const { repos, ctx } = await resolveStudio();
    const body = await getMemberCalendarFeed(repos, token, ctx.studio.name);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="calendar.ics"',
      },
    });
  });
}
