import { handle } from "@/lib/http";
import { getMemberUpcomingCalendar } from "@/lib/services/member-calendar";
import { resolveStudio } from "@/lib/services/context";
import { toICalendar } from "@/lib/domain/ical";

export const dynamic = "force-dynamic";

// Sanitize filename to ASCII-safe characters for HTTP headers and percent-encode for UTF-8.
// Removes non-ASCII characters and special characters that could cause header injection.
function sanitizeFilename(name: string): string {
  // First, try to decompose accented characters and strip diacritics.
  const normalized = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
  // Remove any remaining non-ASCII characters and problematic chars (quotes, newlines, etc).
  const ascii = normalized
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/["']/g, "");
  // If completely empty after sanitization, use a default.
  return ascii.trim() || "calendar";
}

// GET /api/ical/[token] — a private iCalendar feed for a single member's
// upcoming booked sessions. No authentication: the secret token in the URL is
// the only authorization. Unknown or empty tokens return 404 (never leak another
// member's schedule).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const { token } = await params;
    const { member, events } = await getMemberUpcomingCalendar(repos, token, new Date());
    const body = toICalendar(events, {
      calendarName: `${member.name} at ${ctx.studio.name}`,
    });
    const safeFilename = sanitizeFilename(member.name);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="${safeFilename}.ics"`,
      },
    });
  });
}
