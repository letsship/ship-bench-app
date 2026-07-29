import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { badRequest, handle } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { bookingsToCsv, invoicesToCsv, membersToCsv } from "@/lib/domain/csv";
import { listBookingsForExport } from "@/lib/services/booking-list";
import { listInvoices } from "@/lib/services/invoices";
import { listMembers } from "@/lib/services/members";
import { exportQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/export?type=members|invoices|bookings — a CSV download. Bookings
// additionally accepts optional `from`/`to` ISO-8601 bounds (inclusive on both
// ends) over the session start time. All types require a signed-in session.
export async function GET(request: NextRequest): Promise<Response> {
  return handle(async () => {
    await requireSession();
    const { repos, ctx } = await resolveStudio();
    const query = exportQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    if (!query.success) {
      return badRequest("Invalid export query", query.error.flatten());
    }
    const { type, from, to } = query.data;

    let csv: string;
    if (type === "members") {
      csv = membersToCsv(await listMembers(repos, ctx.studio.id));
    } else if (type === "invoices") {
      csv = invoicesToCsv(await listInvoices(repos, ctx.studio.id));
    } else {
      csv = bookingsToCsv(
        (await listBookingsForExport(repos, ctx.studio.id, { from, to })).map((row) => ({
          startsAt: row.startsAt,
          className: row.className,
          memberName: row.memberName,
          email: row.memberEmail,
          status: row.status,
        })),
      );
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
