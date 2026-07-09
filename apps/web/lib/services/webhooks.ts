import type { Repositories } from "@/lib/db/repos/types";
import type { StripeWebhookEventInput } from "@/lib/validation";

// Domain handling for verified Stripe webhook events. Signature verification
// happens in the route handler — by the time an event reaches here it is
// known to be genuinely from Stripe, so this only needs to worry about
// idempotency and the invoice.paid side effect.

export async function handleStripeWebhookEvent(
  repos: Repositories,
  event: StripeWebhookEventInput,
): Promise<void> {
  const existing = await repos.webhookEvents.getById(event.id);
  if (existing) return;

  if (event.type === "invoice.paid") {
    const invoiceId = event.data.object.metadata.invoice_id;
    const invoice = invoiceId ? await repos.invoices.getById(invoiceId) : null;
    if (invoice) {
      await repos.invoices.update(invoice.id, { status: "paid", paidAt: new Date().toISOString() });
    }
  }

  await repos.webhookEvents.insert({
    id: event.id,
    type: event.type,
    processedAt: new Date().toISOString(),
  });
}
