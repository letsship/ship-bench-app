import { eq } from "drizzle-orm";
import { invoices } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import {
  type MonthlyRevenueRow,
  type RevenueTotals,
  monthlyRevenue,
  revenueTotals,
} from "@/lib/domain/reports";
import type { StudioContext } from "./studio";

export interface RevenueReport {
  rows: MonthlyRevenueRow[];
  totals: RevenueTotals;
  currency: string;
  timezone: string;
}

export async function getRevenueReport(db: Db, ctx: StudioContext): Promise<RevenueReport> {
  const rows = await db
    .select({
      status: invoices.status,
      issuedAt: invoices.issuedAt,
      totalCents: invoices.totalCents,
    })
    .from(invoices)
    .where(eq(invoices.studioId, ctx.studio.id));
  const monthly = monthlyRevenue(rows, ctx.studio.timezone);
  return {
    rows: monthly,
    totals: revenueTotals(monthly),
    currency: ctx.settings.currency,
    timezone: ctx.studio.timezone,
  };
}
