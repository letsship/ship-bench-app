import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { badRequest, handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { bookingsToCsv, invoicesToCsv, membersToCsv } from "@/lib/domain/csv";
import { listBookingExportRows } from "@/lib/services/booking-list";
import { listInvoices } from "@/lib/services/invoices";
import { listMembers } from "@/lib/services/members";

export const dynamic = "force-dynamic";

// GET /api/export?type=members|invoices|bookings — a CSV download. The bookings
// export also takes optional ISO-8601 `from`/`to` bounds (inclusive both ends).
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const params = request.nextUrl.searchParams;
    const type = params.get("type") ?? "members";

    let csv: string;
    if (type === "members") {
      csv = membersToCsv(await listMembers(repos, ctx.studio.id));
    } else if (type === "invoices") {
      csv = invoicesToCsv(await listInvoices(repos, ctx.studio.id));
    } else if (type === "bookings") {
      const range = { from: params.get("from") ?? undefined, to: params.get("to") ?? undefined };
      csv = bookingsToCsv(await listBookingExportRows(repos, ctx.studio.id, range));
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
