import type { Repositories } from "@/lib/db/repos/types";
import { type InvoiceStatus, canTransitionInvoice } from "@/lib/domain/invoices";
import type { StripeEvent } from "@/lib/validation";

export async function handleStripeEvent(
  repos: Repositories,
  event: StripeEvent,
): Promise<void> {
  if (event.type !== "invoice.paid") return;

  const invoiceId = event.data.object.metadata?.invoice_id;
  if (!invoiceId) return;

  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice || !canTransitionInvoice(invoice.status as InvoiceStatus, "paid")) return;

  await repos.invoices.update(invoice.id, {
    status: "paid",
    paidAt: new Date().toISOString(),
  });
}
