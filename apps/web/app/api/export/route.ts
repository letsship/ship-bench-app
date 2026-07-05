import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { badRequest, handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { bookingsToCsv, invoicesToCsv, membersToCsv } from "@/lib/domain/csv";
import { listBookingExportRows } from "@/lib/services/booking-list";
import { listInvoices } from "@/lib/services/invoices";
import { listMembers } from "@/lib/services/members";
import { exportBookingsQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/export?type=members|invoices|bookings[&from=&to=] — a CSV download.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const type = request.nextUrl.searchParams.get("type") ?? "members";

    let csv: string;
    if (type === "members") {
      csv = membersToCsv(await listMembers(repos, ctx.studio.id));
    } else if (type === "invoices") {
      csv = invoicesToCsv(await listInvoices(repos, ctx.studio.id));
    } else if (type === "bookings") {
      const { from, to } = exportBookingsQuerySchema.parse({
        from: request.nextUrl.searchParams.get("from") ?? undefined,
        to: request.nextUrl.searchParams.get("to") ?? undefined,
      });
      csv = bookingsToCsv(await listBookingExportRows(repos, ctx.studio.id, { from, to }));
    } else {
      return badRequest(`Unknown export type: ${type}`);
    }

    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="studiobook-${type}.csv"`,
      },
    });
  });
}
