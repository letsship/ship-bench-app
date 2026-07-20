import type { Repositories } from "@/lib/db/repos/types";
import type { StripeEvent } from "@/lib/validation";

export type WebhookOutcome = "marked_paid" | "already_paid" | "unknown_invoice" | "ignored";

export async function processStripeEvent(
  repos: Repositories,
  event: StripeEvent,
): Promise<WebhookOutcome> {
  // Only process invoice.paid events
  if (event.type !== "invoice.paid") {
    return "ignored";
  }

  // Extract the invoice ID from the Stripe event metadata
  const invoiceId = event.data.object.metadata?.invoice_id;
  if (!invoiceId) {
    return "unknown_invoice";
  }

  // Load the invoice
  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice) {
    return "unknown_invoice";
  }

  // Idempotency guard: if already paid, don't update
  if (invoice.status === "paid") {
    return "already_paid";
  }

  // Mark as paid
  const paidAt = new Date().toISOString();
  await repos.invoices.update(invoiceId, { status: "paid", paidAt });

  return "marked_paid";
}
