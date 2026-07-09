import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { getMember, updateMember } from "@/lib/services/members";
import { updateMemberSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

// GET /api/members/:id — a single member.
export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    const { repos } = await resolveStudio();
    const { id } = params;
    return ok(await getMember(repos, id));
  });
}

// PATCH /api/members/:id — update member details or notification opt-out.
export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const { id } = params;
    const input = updateMemberSchema.parse(await request.json());
    return ok(await updateMember(repos, id, input));
  });
}
