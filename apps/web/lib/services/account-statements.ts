import type { Repositories } from "@/lib/db/repos/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";

// A per-member account statement: each of the member's invoices with its total
// recomputed from the line items via the canonical domain calculation, so a
// refunded line drops out of the taxable subtotal here exactly as it does on
// the invoice itself.

export interface StatementLine {
  invoiceId: string;
  number: string;
  subtotalCents: number;
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
  const lines = await Promise.all(
    invoices.map(async (invoice): Promise<StatementLine> => {
      const items = await repos.invoiceLineItems.listByInvoice(invoice.id);
      const totals = computeInvoiceTotals(items, invoice.taxRateBps);
      return {
        invoiceId: invoice.id,
        number: invoice.number,
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
      };
    }),
  );
  return { lines, balanceCents: lines.reduce((sum, line) => sum + line.totalCents, 0) };
}
