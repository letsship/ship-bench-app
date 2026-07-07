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
    // Read `from`/`to` straight off the raw query string with
    // `decodeURIComponent` rather than `request.nextUrl.searchParams`. The
    // WHATWG `URLSearchParams` used by `nextUrl` follows the
    // `application/x-www-form-urlencoded` decoding rule on some edge runtimes
    // (notably Cloudflare Workers via OpenNext), which turns a literal `+` —
    // or a percent-encoded `%2B` — into a space. ISO-8601 UTC offsets use `+`
    // (e.g. `2026-06-27T08:00:00+00:00`, the exact format this export emits in
    // its own `Starts` column), so a `+`-offset timestamp arrived as
    // `...08:00:00 00:00`, failed `Date.parse`, and was silently dropped —
    // returning every booking instead of the filtered range. `decodeURIComponent`
    // never decodes `+` to a space, so any valid ISO-8601 representation (`Z`,
    // `+00:00`, or a real offset) survives intact.
    const rawQuery = request.url.split("?", 2)[1] ?? "";
    const params = parseRawQuery(rawQuery);
    const from = params.get("from") ?? undefined;
    const to = params.get("to") ?? undefined;

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

// Parse a raw query string (the bytes after `?`) using `decodeURIComponent`,
// which — unlike `URLSearchParams` — never decodes `+` to a space. This keeps
// `+`-bearing ISO-8601 UTC offsets (`+00:00`, `+05:30`) intact regardless of
// the runtime's query-decoding quirks.
function parseRawQuery(query: string): URLSearchParams {
  const params = new URLSearchParams();
  if (!query) return params;
  for (const pair of query.split("&")) {
    if (pair === "") continue;
    const eq = pair.indexOf("=");
    const key = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq));
    const value = eq === -1 ? "" : decodeURIComponent(pair.slice(eq + 1));
    params.append(key, value);
  }
  return params;
}
