import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { badRequest, handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { bookingsToCsv, invoicesToCsv, membersToCsv } from "@/lib/domain/csv";
import { listBookingRows } from "@/lib/services/booking-list";
import { listInvoices } from "@/lib/services/invoices";
import { listMembers } from "@/lib/services/members";

export const dynamic = "force-dynamic";

// GET /api/export?type=members|invoices|bookings — a CSV download.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const type = request.nextUrl.searchParams.get("type") ?? "members";
    const from = request.nextUrl.searchParams.get("from") ?? undefined;
    const to = request.nextUrl.searchParams.get("to") ?? undefined;

    let csv: string;
    if (type === "members") {
      csv = membersToCsv(await listMembers(repos, ctx.studio.id));
    } else if (type === "invoices") {
      csv = invoicesToCsv(await listInvoices(repos, ctx.studio.id));
    } else if (type === "bookings") {
      // Parse `from`/`to` as real timestamps (not lexicographic strings) so any
      // valid ISO-8601 UTC form works — `Z`, `+00:00`, or an offset. The repo's
      // SessionRange treats `to` as exclusive and compares strings, which would
      // both drop a session starting exactly at `to` and miscompare differently
      // formatted-but-equal instants; so fetch with `from` only (normalized to
      // a canonical `Z` timestamp the DB layer handles consistently) and apply
      // an inclusive `to` bound here using epoch-millis comparison.
      const fromMs = from ? Date.parse(from) : NaN;
      const toMs = to ? Date.parse(to) : NaN;
      const rows = await listBookingRows(repos, ctx.studio.id, {
        from: Number.isNaN(fromMs) ? undefined : new Date(fromMs).toISOString(),
      });
      const filtered = Number.isNaN(toMs)
        ? rows
        : rows.filter((row) => Date.parse(row.startsAt) <= toMs);
      csv = bookingsToCsv(filtered);
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
