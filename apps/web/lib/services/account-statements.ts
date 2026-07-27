import type { Repositories } from "@/lib/db/repos/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";

// A per-member account statement: each of the member's invoices with its total
// recomputed from the line items via `computeInvoiceTotals`, the single source
// of truth for invoice arithmetic. Refunded lines drop out of the taxable
// subtotal by delegation, so a statement total always matches the invoice.

export interface StatementLine {
  invoiceId: string;
  number: string;
  subtotalCents: number;
  refundedCents: number;
  taxCents: number;
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
      subtotalCents: totals.subtotalCents,
      refundedCents: totals.refundedCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
    });
  }
  return { lines, balanceCents: lines.reduce((sum, line) => sum + line.totalCents, 0) };
}
