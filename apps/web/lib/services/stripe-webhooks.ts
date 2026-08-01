import type { Repositories } from "@/lib/db/repos/types";
import type { StripeWebhookEvent } from "@/lib/validation";

// Process a Stripe webhook event whose signature has ALREADY been verified by
// the route. Idempotent: the event id is recorded in the webhook_events ledger
// before any effect, and a replay of a recorded id is a no-op. Every verified
// event — replayed, unknown-invoice, or of an unhandled type — resolves
// normally so the route can acknowledge it with a 200.
export async function processStripeWebhookEvent(
  repos: Repositories,
  event: StripeWebhookEvent,
): Promise<void> {
  const seen = await repos.webhookEvents.getById(event.id);
  if (seen) return;
  await repos.webhookEvents.insert({
    id: event.id,
    type: event.type,
    receivedAt: new Date().toISOString(),
  });

  if (event.type !== "invoice.paid") return;
  const invoiceId = event.data.object.metadata?.invoice_id;
  if (!invoiceId) return;
  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice || invoice.status === "paid") return;
  await repos.invoices.update(invoice.id, {
    status: "paid",
    paidAt: new Date().toISOString(),
  });
}
