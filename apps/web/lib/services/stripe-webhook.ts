import type { Repositories } from "@/lib/db/repos/types";
import { canTransitionInvoice, type InvoiceStatus } from "@/lib/domain/invoices";
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
    // Route through the same state machine as the manual PATCH path so a
    // webhook can never force an invoice an operator already voided or
    // refunded back to "paid".
    if (invoice && canTransitionInvoice(invoice.status as InvoiceStatus, "paid")) {
      await repos.invoices.update(invoice.id, {
        status: "paid",
        paidAt: new Date().toISOString(),
      });
    }
  }

  try {
    await repos.processedStripeEvents.insert({
      id: event.id,
      type: event.type,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    // The exists() check above is check-then-act, not atomic: two concurrent
    // deliveries of the same event id can both pass it and both reach here.
    // If a duplicate insert failed on the id primary key, the event is
    // already recorded — treat it as the idempotent no-op it is instead of
    // surfacing a 500 for a legitimate replay. Any other failure still
    // throws.
    if (!(await repos.processedStripeEvents.exists(event.id))) throw error;
  }
}
