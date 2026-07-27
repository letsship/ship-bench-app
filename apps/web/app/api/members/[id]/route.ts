import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { getMember, updateMember } from "@/lib/services/members";
import { updateMemberSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/members/:id — a single member. No session check, so the private
// calendarToken (the sole auth for that member's iCal subscription) must be
// redacted here.
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const { id } = await params;
    const { calendarToken: _calendarToken, ...member } = await getMember(repos, id);
    return ok(member);
  });
}

// PATCH /api/members/:id — update member details or notification opt-out.
export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const { id } = await params;
    const input = updateMemberSchema.parse(await request.json());
    return ok(await updateMember(repos, id, input));
  });
}
