import { resolveTracker } from "@/lib/analytics";
import { requireSession } from "@/lib/auth/session";
import { handle, ok } from "@/lib/http";
import { cancelBooking } from "@/lib/services/bookings";
import { resolveStudio } from "@/lib/services/context";
import { createNotificationProvider } from "@/lib/notifications/provider";

export const dynamic = "force-dynamic";

// DELETE /api/bookings/:id — cancel a booking, promoting the waitlist if a seat
// was freed. Returns whether the cancellation earned a refund.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const { id } = await params;
    return ok(await cancelBooking(repos, createNotificationProvider(), id, resolveTracker()));
  });
}
