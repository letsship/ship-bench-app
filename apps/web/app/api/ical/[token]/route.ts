import { handle } from "@/lib/http";
import { getMemberByCalendarToken } from "@/lib/services/members";
import { getMemberCalendarEvents } from "@/lib/services/calendar";
import { resolveStudio } from "@/lib/services/context";
import { toICalendar } from "@/lib/domain/ical";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const { token } = await params;
    const { repos } = await resolveStudio();

    const member = await getMemberByCalendarToken(repos, token);
    if (!member) {
      return new Response(null, { status: 404 });
    }

    const events = await getMemberCalendarEvents(repos, member, new Date());
    const body = toICalendar(events, { calendarName: `${member.name}'s calendar` });

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="${member.name.replace(/[^a-z0-9]/gi, "_")}.ics"`,
      },
    });
  });
}
