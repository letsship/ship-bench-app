import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { badRequest, handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { bookingsToCsv, invoicesToCsv, membersToCsv } from "@/lib/domain/csv";
import { listBookingsForExport } from "@/lib/services/booking-list";
import { listInvoices } from "@/lib/services/invoices";
import { listMembers } from "@/lib/services/members";

export const dynamic = "force-dynamic";

// A literal "+" in a query value (e.g. the "+00:00" offset of an ISO-8601
// timestamp) arrives here decoded as a space — URLSearchParams applies
// application/x-www-form-urlencoded rules, where "+" means space. Restore it
// when doing so turns an otherwise-unparseable timestamp into a valid one, so
// callers can pass either "...+00:00" or "...Z" for from/to.
function normalizeIsoParam(value: string | undefined): string | undefined {
  if (!value || !value.includes(" ") || !Number.isNaN(Date.parse(value))) return value;
  const restored = value.replace(" ", "+");
  return Number.isNaN(Date.parse(restored)) ? value : restored;
}

// GET /api/export?type=members|invoices|bookings&from=&to= — a CSV download.
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
      const from = normalizeIsoParam(request.nextUrl.searchParams.get("from") ?? undefined);
      const to = normalizeIsoParam(request.nextUrl.searchParams.get("to") ?? undefined);
      csv = bookingsToCsv(await listBookingsForExport(repos, ctx.studio.id, { from, to }));
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
