import { computeInvoiceTotals, type LineItemInput } from "@/lib/domain/invoices";
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

function lineItemToInput(item: InvoiceLineItem): LineItemInput {
  return {
    quantity: item.quantity,
    unitAmountCents: item.unitAmountCents,
    refunded: item.refunded,
  };
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
    const totals = computeInvoiceTotals(items.map(lineItemToInput), invoice.taxRateBps);
    lines.push({
      invoiceId: invoice.id,
      number: invoice.number,
      totalCents: totals.totalCents,
    });
  }
  return { lines, balanceCents: lines.reduce((sum, line) => sum + line.totalCents, 0) };
}
