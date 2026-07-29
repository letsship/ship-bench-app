import type { Repositories } from "@/lib/db/repos/types";
import type { WebhookEvent } from "@/lib/db/types";
import { canTransitionInvoice, type InvoiceStatus } from "@/lib/domain/invoices";
import type { StripeEvent } from "@/lib/domain/stripe-webhook";
import { invoiceIdFromEvent } from "@/lib/domain/stripe-webhook";

// Handle a verified Stripe webhook event. Idempotent: a redelivered event (same
// Stripe event id) is a no-op because its id is already recorded. On
// `invoice.paid` the invoice named in the event metadata is transitioned to
// `paid` with `paidAt` set — but only if its current status allows it, so an
// already-paid (or void/refunded) invoice is acknowledged without error rather
// than throwing. Unknown invoice ids and all other event types are acknowledged
// with no change. Never throws on unknown-invoice/other-type.

export interface HandleStripeEventResult {
  acknowledged: true;
  invoicePaid: boolean;
}

export async function handleStripeEvent(
  repos: Repositories,
  event: StripeEvent,
): Promise<HandleStripeEventResult> {
  // Idempotency: record the event id before doing anything. A replay finds it
  // already present and returns without touching invoices.
  const existing = await repos.webhookEvents.getById(event.id);
  if (existing) {
    return { acknowledged: true, invoicePaid: false };
  }
  await repos.webhookEvents.insert({
    id: event.id,
    type: event.type,
    processedAt: new Date().toISOString(),
  } satisfies WebhookEvent);

  if (event.type !== "invoice.paid") {
    return { acknowledged: true, invoicePaid: false };
  }

  const invoiceId = invoiceIdFromEvent(event);
  if (!invoiceId) return { acknowledged: true, invoicePaid: false };

  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice) return { acknowledged: true, invoicePaid: false };

  if (!canTransitionInvoice(invoice.status as InvoiceStatus, "paid")) {
    // Already paid (or otherwise not transitionable) — acknowledge, no change.
    return { acknowledged: true, invoicePaid: false };
  }

  await repos.invoices.update(invoiceId, {
    status: "paid",
    paidAt: new Date().toISOString(),
  });
  return { acknowledged: true, invoicePaid: true };
}
