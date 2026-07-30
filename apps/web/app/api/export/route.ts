import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { badRequest, handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { bookingsToCsv, invoicesToCsv, membersToCsv } from "@/lib/domain/csv";
import { type BookingRow, listBookingRows } from "@/lib/services/booking-list";
import { listInvoices } from "@/lib/services/invoices";
import { listMembers } from "@/lib/services/members";

export const dynamic = "force-dynamic";

// Both bounds of the bookings range are INCLUSIVE. `from` maps onto the
// repositories' gte bound — normalized so a non-canonical ISO string still
// matches a session starting on that exact instant — but their `to` bound is
// exclusive, so the upper end is applied here instead. An absent or
// unparseable bound leaves that side unbounded.
function normalizeFrom(value: string | null): string | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? value : new Date(ms).toISOString();
}

function startingUpTo(rows: readonly BookingRow[], value: string | null): BookingRow[] {
  const limit = value === null ? Number.NaN : Date.parse(value);
  if (Number.isNaN(limit)) return [...rows];
  return rows.filter((row) => Date.parse(row.startsAt) <= limit);
}

// GET /api/export?type=members|invoices|bookings — a CSV download.
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
      const rows = await listBookingRows(repos, ctx.studio.id, {
        from: normalizeFrom(params.get("from")),
      });
      csv = bookingsToCsv(startingUpTo(rows, params.get("to")));
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
