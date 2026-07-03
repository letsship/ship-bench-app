import type { Repositories } from "@/lib/db/repos/types";
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

export async function getRevenueReport(
  repos: Repositories,
  ctx: StudioContext,
): Promise<RevenueReport> {
  const invoices = await repos.invoices.listByStudio(ctx.studio.id);
  const monthly = monthlyRevenue(
    invoices.map((invoice) => ({
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      totalCents: invoice.totalCents,
    })),
    ctx.studio.timezone,
  );
  return {
    rows: monthly,
    totals: revenueTotals(monthly),
    currency: ctx.settings.currency,
    timezone: ctx.studio.timezone,
  };
}
