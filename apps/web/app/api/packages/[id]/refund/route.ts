import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { refundPackage } from "@/lib/services/packages";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/packages/:id/refund — refund a pack.
export async function POST(_request: Request, { params }: RouteContext): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const { id } = await params;
    return ok(await refundPackage(repos, id));
  });
}
