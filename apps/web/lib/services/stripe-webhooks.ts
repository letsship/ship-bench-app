import type { Repositories } from "@/lib/db/repos/types";
import { canTransitionInvoice } from "@/lib/domain/invoices";
import type { StripeEvent } from "@/lib/domain/stripe";

export async function processStripeEvent(repos: Repositories, event: StripeEvent): Promise<void> {
  // Only process invoice.paid events.
  if (event.type !== "invoice.paid") {
    return;
  }

  // Extract the invoice_id from the metadata.
  const invoiceId = event.data.object.metadata?.invoice_id;
  if (!invoiceId) {
    // Missing metadata, acknowledge and ignore.
    return;
  }

  // Look up the invoice.
  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice) {
    // Unknown invoice, acknowledge and ignore.
    return;
  }

  // Check if we can transition to paid. If the invoice is already paid or cannot
  // transition to paid, this is a no-op (idempotency guard).
  if (
    !canTransitionInvoice(invoice.status as "draft" | "open" | "paid" | "void" | "refunded", "paid")
  ) {
    return;
  }

  // Mark the invoice as paid.
  const paidAt = new Date().toISOString();
  await repos.invoices.update(invoiceId, { status: "paid", paidAt });
}
