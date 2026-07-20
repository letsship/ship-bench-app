import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { refundPack } from "@/lib/services/packs";

export const dynamic = "force-dynamic";

// POST /api/packages/{id}/refund — refund a pack.
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const { id } = await props.params;
    return ok(await refundPack(repos, id));
  });
}
