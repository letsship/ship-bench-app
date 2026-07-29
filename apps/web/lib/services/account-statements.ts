import { computeInvoiceTotals } from "@/lib/domain/invoices";
import type { Repositories } from "@/lib/db/repos/types";
import type { InvoiceLineItem } from "@/lib/db/types";

// A per-member account statement: each of the member's invoices with its total
// recomputed from the line items.

export interface StatementLine {
  invoiceId: string;
  number: string;
  totalCents: number;
}

export interface MemberStatement {
  lines: StatementLine[];
  balanceCents: number;
}

// Recompute an invoice's total through the single domain source of truth so
// refunded lines are excluded from the taxable subtotal identically to the
// stored invoice and the invoice page.
function statementTotal(lineItems: readonly InvoiceLineItem[], taxRateBps: number): number {
  return computeInvoiceTotals(lineItems, taxRateBps).totalCents;
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
    lines.push({
      invoiceId: invoice.id,
      number: invoice.number,
      totalCents: statementTotal(items, invoice.taxRateBps),
    });
  }
  return { lines, balanceCents: lines.reduce((sum, line) => sum + line.totalCents, 0) };
}
