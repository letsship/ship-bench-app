import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { refundPackage } from "@/lib/services/packages";

export const dynamic = "force-dynamic";

// POST /api/packages/:id/refund — void a pack's remaining credits.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const { id } = await params;
    return ok(await refundPackage(repos, id));
  });
}
