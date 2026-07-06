import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { badRequest, handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { bookingsToCsv, invoicesToCsv, membersToCsv } from "@/lib/domain/csv";
import { listBookingRowsForExport } from "@/lib/services/booking-list";
import { listInvoices } from "@/lib/services/invoices";
import { listMembers } from "@/lib/services/members";

export const dynamic = "force-dynamic";

// GET /api/export?type=members|invoices — a CSV download.
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
      let from: string | undefined = request.nextUrl.searchParams.get("from") ?? undefined;
      let to: string | undefined = request.nextUrl.searchParams.get("to") ?? undefined;
      // Edge runtimes (CF Workers) decode "%2B" → "+" in the query string, then
      // URLSearchParams interprets the literal "+" as a space per the
      // application/x-www-form-urlencoded spec.  Restore "+" in ISO-8601
      // timezone offsets so inclusive-boundary comparisons work.
      from = from?.replace(/ (\d{2}:\d{2})$/, "+$1");
      to = to?.replace(/ (\d{2}:\d{2})$/, "+$1");
      csv = bookingsToCsv(await listBookingRowsForExport(repos, ctx.studio.id, { from, to }));
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
