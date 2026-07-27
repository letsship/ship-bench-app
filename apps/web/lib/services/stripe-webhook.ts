import type { Repositories } from "@/lib/db/repos/types";
import { canTransitionInvoice, type InvoiceStatus } from "@/lib/domain/invoices";
import type { StripeEvent } from "@/lib/validation";

export async function processStripeEvent(repos: Repositories, event: StripeEvent): Promise<void> {
  // Idempotency: if we've already processed this event id, skip.
  if (await repos.webhookEvents.has(event.id)) {
    return;
  }

  // Record the event id to prevent re-processing.
  await repos.webhookEvents.record(event.id);

  // Only process invoice.paid events.
  if (event.type !== "invoice.paid") {
    return;
  }

  // Extract the invoice id from event metadata.
  const invoiceId = event.data.object.metadata?.invoice_id;
  if (!invoiceId) {
    return;
  }

  // Fetch the invoice.
  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice) {
    return;
  }

  // Only transition to paid if it's not already paid.
  const currentStatus = invoice.status as InvoiceStatus;
  if (currentStatus === "paid" || !canTransitionInvoice(currentStatus, "paid")) {
    return;
  }

  // Mark the invoice as paid with the current timestamp.
  const paidAt = new Date().toISOString();
  await repos.invoices.update(invoiceId, { status: "paid", paidAt });
}
