import type { Repositories } from "@/lib/db/repos/types";
import type { StripeEvent } from "@/lib/validation";

// Process a signature-verified Stripe webhook event. Idempotency comes first:
// each processed event id is recorded in the webhook-events ledger, and a
// redelivery of a known id is acknowledged without touching anything. Unknown
// invoices and non-invoice.paid event types are acknowledged too (Stripe keeps
// retrying anything that is not a 2xx) — they just change nothing.

export interface StripeEventResult {
  received: true;
  duplicate: boolean;
  invoiceMarkedPaid: boolean;
}

// The webhook is Stripe's confirmation that money moved, so it sets the status
// directly rather than going through the guarded open→paid transition — a paid
// invoice stays paid (with its original paidAt) no matter what state we held.
async function markInvoicePaid(repos: Repositories, event: StripeEvent): Promise<boolean> {
  const invoiceId = event.data?.object?.metadata?.invoice_id;
  if (!invoiceId) return false;
  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice) return false;
  await repos.invoices.update(invoiceId, {
    status: "paid",
    paidAt: invoice.paidAt ?? new Date().toISOString(),
  });
  return true;
}

export async function processStripeEvent(
  repos: Repositories,
  event: StripeEvent,
): Promise<StripeEventResult> {
  const seen = await repos.webhookEvents.getById(event.id);
  if (seen) return { received: true, duplicate: true, invoiceMarkedPaid: false };

  const invoiceMarkedPaid =
    event.type === "invoice.paid" ? await markInvoicePaid(repos, event) : false;

  await repos.webhookEvents.insert({
    id: event.id,
    type: event.type,
    receivedAt: new Date().toISOString(),
  });
  return { received: true, duplicate: false, invoiceMarkedPaid };
}
