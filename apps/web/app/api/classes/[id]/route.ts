import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { cancelSession } from "@/lib/services/classes";
import { resolveStudio } from "@/lib/services/context";
import { createNotificationProvider } from "@/lib/notifications/provider";

export const dynamic = "force-dynamic";

// DELETE /api/classes/:id — cancel a scheduled class and notify all affected members.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const { id } = await params;
    return ok(await cancelSession(repos, createNotificationProvider(), id));
  });
}
