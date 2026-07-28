// Service that applies a verified Stripe event to the application state.
// Idempotent: the same event arriving twice leaves the invoice paid exactly
// once. Unknown invoices, already-paid invoices, and non-`invoice.paid` events
// are all silent no-ops so the route can always answer 200.

import type { Repositories } from "@/lib/db/repos/types";

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: {
      metadata: {
        invoice_id?: string | undefined;
      };
    };
  };
}

/**
 * Handle a verified Stripe webhook event.
 *
 * For `invoice.paid` events, marks the named invoice as paid (idempotently).
 * All other event types and unknown invoices are silently acknowledged.
 * Never throws — the caller (the route handler) always responds 200.
 */
export async function handleStripeEvent(
  repos: Repositories,
  event: StripeWebhookEvent,
): Promise<void> {
  if (event.type !== "invoice.paid") return;

  const invoiceId = event.data?.object?.metadata?.invoice_id;
  if (!invoiceId) return;

  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice) return;

  // Already paid — idempotent replay guard.  This is what keeps us from
  // double-processing: we don't use the domain's canTransitionInvoice (which
  // would throw 409 on paid->paid).
  if (invoice.status === "paid") return;

  await repos.invoices.update(invoiceId, {
    status: "paid",
    paidAt: new Date().toISOString(),
  });
}