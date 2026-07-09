import type { Repositories } from "@/lib/db/repos/types";

// Handles a verified Stripe event. The signature check happens in the route
// handler before this is ever called — this function's own job is purely
// idempotency + the invoice side effect.

export interface StripeInvoicePaidEvent {
  id: string;
  type: string;
  data: {
    object: {
      metadata?: {
        invoice_id?: string;
      };
    };
  };
}

export interface HandleStripeEventResult {
  processed: boolean;
}

// Deliberately bypasses canTransitionInvoice (lib/domain/invoices.ts, used by
// the manual PATCH endpoint) — the stripe_events ledger below is what makes
// replay safe here, not the invoice state machine.
export async function handleStripeEvent(
  repos: Repositories,
  event: StripeInvoicePaidEvent,
): Promise<HandleStripeEventResult> {
  const seen = await repos.stripeEvents.getById(event.id);
  if (seen) return { processed: false };

  await repos.stripeEvents.insert({
    id: event.id,
    type: event.type,
    receivedAt: new Date().toISOString(),
  });

  if (event.type !== "invoice.paid") return { processed: false };

  const invoiceId = event.data.object.metadata?.invoice_id;
  if (!invoiceId) return { processed: false };

  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice || invoice.status === "paid") return { processed: false };

  await repos.invoices.update(invoiceId, { status: "paid", paidAt: new Date().toISOString() });
  return { processed: true };
}
