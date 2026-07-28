import { computeInvoiceTotals } from "@/lib/domain/invoices";
import type { Repositories } from "@/lib/db/repos/types";

// A per-member account statement: each of the member's invoices with its total
// recomputed from the line items via the canonical domain function, so a
// refunded line is excluded from the taxable subtotal exactly as on the
// invoice record itself.

export interface StatementLine {
  invoiceId: string;
  number: string;
  totalCents: number;
}

export interface MemberStatement {
  lines: StatementLine[];
  balanceCents: number;
}

export async function getMemberStatement(
  repos: Repositories,
  studioId: string,
  memberId: string,
): Promise<MemberStatement> {
  const invoices = (await repos.invoices.listByStudio(studioId)).filter(
    (invoice) => invoice.memberId === memberId,
  );
  const lines: StatementLine[] = [];
  for (const invoice of invoices) {
    const items = await repos.invoiceLineItems.listByInvoice(invoice.id);
    const totals = computeInvoiceTotals(items, invoice.taxRateBps);
    lines.push({
      invoiceId: invoice.id,
      number: invoice.number,
      totalCents: totals.totalCents,
    });
  }
  return { lines, balanceCents: lines.reduce((sum, line) => sum + line.totalCents, 0) };
}
