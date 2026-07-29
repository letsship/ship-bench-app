import type { Repositories } from "@/lib/db/repos/types";
import type { ProcessedWebhookEvent } from "@/lib/db/types";
import type { StripeEvent } from "@/lib/validation";

// Handle a verified Stripe webhook event. Called by the webhook route AFTER
// signature verification has passed. Idempotency is enforced first by Stripe
// event id: if we have already recorded the event, return without re-processing.
//
// For an `invoice.paid` event, the invoice named at
// `data.object.metadata.invoice_id` is marked paid (status -> "paid", paidAt
// set) if it exists and is not already paid. Finally the event id is recorded
// for EVERY verified event — including unknown-invoice and other-type events —
// so replays of any event id are deduped. All work is awaited (Workers rule:
// no fire-and-forget).

export async function handleStripeEvent(
  repos: Repositories,
  event: StripeEvent,
): Promise<void> {
  const already = await repos.webhookEvents.getById(event.id);
  if (already) return;

  if (event.type === "invoice.paid") {
    const invoiceId = event.data?.object?.metadata?.invoice_id;
    if (invoiceId) {
      const invoice = await repos.invoices.getById(invoiceId);
      if (invoice && invoice.status !== "paid") {
        await repos.invoices.update(invoice.id, {
          status: "paid",
          paidAt: new Date().toISOString(),
        });
      }
    }
  }

  const processed: ProcessedWebhookEvent = {
    id: event.id,
    type: event.type,
    processedAt: new Date().toISOString(),
  };
  await repos.webhookEvents.insert(processed);
}
