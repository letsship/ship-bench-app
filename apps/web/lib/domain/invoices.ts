// Invoice arithmetic. All amounts are integer cents; tax is a basis-point rate
// (2100 = 21%). Refunded line items keep contributing history but drop out of
// the payable subtotal.

export interface LineItemInput {
  quantity: number;
  unitAmountCents: number;
  refunded?: boolean;
}

export interface InvoiceTotals {
  subtotalCents: number;
  refundedCents: number;
  taxCents: number;
  totalCents: number;
}

export function lineAmountCents(item: LineItemInput): number {
  return item.quantity * item.unitAmountCents;
}

// Tax applies only to the non-refunded subtotal, rounded to the nearest cent.
export function computeInvoiceTotals(
  items: readonly LineItemInput[],
  taxRateBps: number,
): InvoiceTotals {
  let subtotalCents = 0;
  let refundedCents = 0;
  for (const item of items) {
    if (item.refunded) refundedCents += lineAmountCents(item);
    else subtotalCents += lineAmountCents(item);
  }
  const taxCents = Math.round((subtotalCents * taxRateBps) / 10_000);
  return { subtotalCents, refundedCents, taxCents, totalCents: subtotalCents + taxCents };
}

// Sequential, zero-padded invoice number scoped to a year, e.g. "INV-2026-0007".
export function formatInvoiceNumber(sequence: number, year: number): string {
  return `INV-${year}-${String(sequence).padStart(4, "0")}`;
}

export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "refunded";

const INVOICE_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: ["open", "void"],
  open: ["paid", "void"],
  paid: ["refunded"],
  void: [],
  refunded: [],
};

export function canTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return INVOICE_TRANSITIONS[from].includes(to);
}

// An invoice is overdue when it is still open past its due date.
export function isOverdue(invoice: { status: string; dueAt: string | null }, now: string): boolean {
  if (invoice.status !== "open" || !invoice.dueAt) return false;
  return new Date(now).getTime() > new Date(invoice.dueAt).getTime();
}
