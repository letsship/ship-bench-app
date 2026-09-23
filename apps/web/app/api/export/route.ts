import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { badRequest, handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { bookingsToCsv, invoicesToCsv, membersToCsv } from "@/lib/domain/csv";
import { listBookingExportRows } from "@/lib/services/booking-list";
import { listInvoices } from "@/lib/services/invoices";
import { listMembers } from "@/lib/services/members";
import { exportQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/export?type=members|invoices|bookings — a CSV download.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();

    const parsed = exportQuerySchema.safeParse({
      type: request.nextUrl.searchParams.get("type") ?? undefined,
      from: request.nextUrl.searchParams.get("from") ?? undefined,
      to: request.nextUrl.searchParams.get("to") ?? undefined,
    });
    if (!parsed.success) return badRequest("Invalid export query", parsed.error.flatten());
    const { type, from, to } = parsed.data;

    let csv: string;
    if (type === "members") {
      csv = membersToCsv(await listMembers(repos, ctx.studio.id));
    } else if (type === "invoices") {
      csv = invoicesToCsv(await listInvoices(repos, ctx.studio.id));
    } else if (type === "bookings") {
      const rows = await listBookingExportRows(repos, ctx.studio.id, { from, to });
      csv = bookingsToCsv(rows);
    } else {
      // Exhaustive fallback: if a fourth type joins exportQuerySchema's enum,
      // fail loudly (400) instead of silently serving a bookings CSV.
      return badRequest("Unknown export type");
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