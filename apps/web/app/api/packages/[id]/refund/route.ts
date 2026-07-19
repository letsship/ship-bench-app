import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { refundClassPack } from "@/lib/services/class-packs";
import { resolveStudio } from "@/lib/services/context";

export const dynamic = "force-dynamic";

// POST /api/packages/:id/refund — refund a class pack.
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const { id } = await props.params;
    return ok(await refundClassPack(repos, id));
  });
}
