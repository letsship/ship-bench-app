import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { badRequest, handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { bookingsToCsv, invoicesToCsv, membersToCsv } from "@/lib/domain/csv";
import { listInvoices } from "@/lib/services/invoices";
import { listMembers } from "@/lib/services/members";
import { listBookingsForExport } from "@/lib/services/booking-list";

export const dynamic = "force-dynamic";

// GET /api/export?type=members|invoices|bookings — a CSV download.
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
      const from = request.nextUrl.searchParams.get("from") ?? undefined;
      const to = request.nextUrl.searchParams.get("to") ?? undefined;
      const rows = await listBookingsForExport(repos, ctx.studio.id, { from, to });
      csv = bookingsToCsv(
        rows.map((row) => ({
          starts: row.startsAt,
          className: row.className,
          memberName: row.memberName,
          email: row.email ?? "",
          status: row.status,
        })),
      );
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
