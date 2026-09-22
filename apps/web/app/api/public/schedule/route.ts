import { resolveRepositories } from "@/lib/db/repos";
import { handle, ok } from "@/lib/http";
import { listPublicSchedule } from "@/lib/services/public-schedule";
import { publicScheduleQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/public/schedule?studio=<id> — unauthenticated public schedule endpoint.
// Returns the studio's upcoming scheduled classes for the next 14 days, suitable
// for embedding on a public marketing site. The response includes only class-level
// fields: title, start time, duration, instructor, and seats available. No member,
// booking, or invoice data is included.
export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { searchParams } = new URL(request.url);
    const query = publicScheduleQuerySchema.parse({
      studio: searchParams.get("studio"),
    });

    const repos = await resolveRepositories();
    const publicClasses = await listPublicSchedule(repos, query.studio, new Date());

    return ok(publicClasses);
  });
}
