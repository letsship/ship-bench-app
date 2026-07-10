import type { Repositories } from "@/lib/db/repos/types";
import type { StripeEventInput } from "@/lib/validation";

// Maps a verified Stripe webhook event onto the invoice status machine. Every
// branch other than "known invoice.paid event" is a recorded no-op, never an
// error — duplicate deliveries, unknown invoices, and unrelated event types
// are all valid per the webhook contract.
export async function processStripeWebhookEvent(
  repos: Repositories,
  event: StripeEventInput,
): Promise<void> {
  if (await repos.processedStripeEvents.exists(event.id)) return;

  if (event.type === "invoice.paid") {
    const invoiceId = event.data.object.metadata?.invoice_id;
    const invoice = invoiceId ? await repos.invoices.getById(invoiceId) : null;
    if (invoice) {
      await repos.invoices.update(invoice.id, {
        status: "paid",
        paidAt: new Date().toISOString(),
      });
    }
  }

  await repos.processedStripeEvents.insert({
    id: event.id,
    type: event.type,
    createdAt: new Date().toISOString(),
  });
}
