import type { Repositories } from "@/lib/db/repos/types";
import type { StripeWebhookEvent } from "@/lib/validation";

export interface StripeWebhookResult {
  handled: boolean;
  invoiceId: string | null;
}

// Processes a verified Stripe webhook event: marks the named invoice paid on
// `invoice.paid`, and always records the event id so a redelivered event is a
// no-op. Never throws for an unknown invoice or an unhandled event type —
// those are acknowledged (200) without changing anything.
export async function processStripeWebhookEvent(
  repos: Repositories,
  event: StripeWebhookEvent,
): Promise<StripeWebhookResult> {
  const alreadyProcessed = await repos.webhookEvents.getById(event.id);
  if (alreadyProcessed) return { handled: false, invoiceId: null };

  let result: StripeWebhookResult = { handled: false, invoiceId: null };

  if (event.type === "invoice.paid") {
    const invoiceId = event.data.object.metadata?.invoice_id;
    const invoice = invoiceId ? await repos.invoices.getById(invoiceId) : null;
    if (invoice && invoice.status !== "paid") {
      await repos.invoices.update(invoice.id, {
        status: "paid",
        paidAt: new Date().toISOString(),
      });
      result = { handled: true, invoiceId: invoice.id };
    }
  }

  await repos.webhookEvents.insert({
    id: event.id,
    type: event.type,
    receivedAt: new Date().toISOString(),
  });

  return result;
}
