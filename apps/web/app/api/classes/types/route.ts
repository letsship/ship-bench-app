import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { createClassType, listClassTypes } from "@/lib/services/classes";
import { resolveStudio } from "@/lib/services/context";
import { createClassTypeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/classes/types — the class catalog (Vinyasa Flow, Wheel Throwing, …).
export async function GET(): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    return ok(await listClassTypes(repos, ctx.studio.id));
  });
}

// POST /api/classes/types — add a class type to the catalog.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const input = createClassTypeSchema.parse(await request.json());
    return created(await createClassType(repos, ctx.studio.id, input));
  });
}
