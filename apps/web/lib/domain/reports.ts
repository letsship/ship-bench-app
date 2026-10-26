import { monthKey } from "./dates";

// Monthly revenue report. Buckets invoices by the calendar month of their issue
// date in the studio's timezone, then sums paid and refunded totals.

export interface ReportInvoice {
  status: string;
  issuedAt: string;
  totalCents: number;
}

export interface MonthlyRevenueRow {
  month: string;
  invoiceCount: number;
  paidCents: number;
  refundedCents: number;
  // Net recognised revenue for the month: paid minus refunded.
  netCents: number;
}

interface MutableRow {
  invoiceCount: number;
  paidCents: number;
  refundedCents: number;
}

// Rows are returned ascending by month. Draft and void invoices are counted but
// contribute no revenue; only "paid" adds to paidCents and "refunded" to
// refundedCents.
export function monthlyRevenue(
  invoices: readonly ReportInvoice[],
  timeZone: string,
): MonthlyRevenueRow[] {
  const buckets = new Map<string, MutableRow>();
  for (const invoice of invoices) {
    const month = monthKey(invoice.issuedAt, timeZone);
    const row = buckets.get(month) ?? { invoiceCount: 0, paidCents: 0, refundedCents: 0 };
    row.invoiceCount += 1;
    if (invoice.status === "paid") row.paidCents += invoice.totalCents;
    else if (invoice.status === "refunded") row.refundedCents += invoice.totalCents;
    buckets.set(month, row);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, row]) => ({
      month,
      invoiceCount: row.invoiceCount,
      paidCents: row.paidCents,
      refundedCents: row.refundedCents,
      netCents: row.paidCents - row.refundedCents,
    }));
}

export interface RevenueTotals {
  paidCents: number;
  refundedCents: number;
  netCents: number;
}

export function revenueTotals(rows: readonly MonthlyRevenueRow[]): RevenueTotals {
  return rows.reduce<RevenueTotals>(
    (totals, row) => ({
      paidCents: totals.paidCents + row.paidCents,
      refundedCents: totals.refundedCents + row.refundedCents,
      netCents: totals.netCents + row.netCents,
    }),
    { paidCents: 0, refundedCents: 0, netCents: 0 },
  );
}

function previousMonth(month: string): string {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  return monthNumber === 1
    ? `${year - 1}-12`
    : `${year}-${String(monthNumber - 1).padStart(2, "0")}`;
}

function percentChange(netCents: number, previousNetCents: number | undefined): number | null {
  if (!previousNetCents) return null;
  return Math.round(((netCents - previousNetCents) / Math.abs(previousNetCents)) * 100);
}

// Whole-percent change in net revenue against the immediately preceding calendar
// month. Null when that month has no row or zero net. Rows are ascending by month.
export function netChangePercents(rows: readonly MonthlyRevenueRow[]): (number | null)[] {
  const netByMonth = new Map(rows.map((row) => [row.month, row.netCents]));
  return rows.map((row) => percentChange(row.netCents, netByMonth.get(previousMonth(row.month))));
}

export function formatChangePercent(value: number | null): string {
  if (value === null) return "n/a";
  if (value > 0) return `+${value}%`;
  if (value < 0) return `${value}%`;
  return "0%";
}
