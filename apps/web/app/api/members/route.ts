import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { createMember, listMembers } from "@/lib/services/members";
import { createMemberSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/members — the studio's members.
export async function GET(): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    return ok(await listMembers(repos, ctx.studio.id));
  });
}

// POST /api/members — add a member.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createMemberSchema.parse(await request.json());
    return created(await createMember(repos, ctx.studio.id, input));
  });
}
