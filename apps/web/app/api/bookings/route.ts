import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { created, handle, ok } from "@/lib/http";
import { listBookingRows } from "@/lib/services/booking-list";
import { createBooking } from "@/lib/services/bookings";
import { resolveStudio } from "@/lib/services/context";
import { createNotificationProvider } from "@/lib/notifications/provider";
import { resolveTracker } from "@/lib/analytics/tracker";
import { createBookingSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/bookings?from=&to= — bookings joined to member + session.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const { repos, ctx } = await resolveStudio();
    const from = request.nextUrl.searchParams.get("from") ?? undefined;
    const to = request.nextUrl.searchParams.get("to") ?? undefined;
    return ok(await listBookingRows(repos, ctx.studio.id, { from, to }));
  });
}

// POST /api/bookings — book a member into a session (or waitlist if full).
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos } = await resolveStudio();
    const input = createBookingSchema.parse(await request.json());
    return created(
      await createBooking(repos, createNotificationProvider(), input, resolveTracker()),
    );
  });
}
