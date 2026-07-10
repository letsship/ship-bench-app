import type { Repositories } from "@/lib/db/repos/types";
import type { StripeWebhookEventInput } from "@/lib/validation";

// Idempotently processes a verified Stripe webhook event. The route handler
// verifies the signature before calling this; by the time we get here the
// event is trusted, and the only job left is to record it (once) and act on
// it (once).
export async function processStripeWebhookEvent(
  repos: Repositories,
  event: StripeWebhookEventInput,
): Promise<void> {
  const isNew = await repos.stripeWebhookEvents.insertIfNew({
    id: event.id,
    type: event.type,
    receivedAt: new Date().toISOString(),
  });
  if (!isNew) return; // replay of an event we already processed — no-op

  if (event.type !== "invoice.paid") return;

  const invoiceId = event.data.object.metadata.invoice_id;
  if (!invoiceId) return;

  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice) return;

  // Marks paid directly rather than going through updateInvoiceStatus's
  // canTransitionInvoice check, which throws on a redundant paid→paid
  // transition — this webhook must tolerate that silently.
  if (invoice.status !== "paid") {
    await repos.invoices.update(invoiceId, { status: "paid", paidAt: new Date().toISOString() });
  }
}
