import type { Repositories } from "@/lib/db/repos/types";
import { type InvoiceStatus, canTransitionInvoice } from "@/lib/domain/invoices";
import { type StripeEvent, invoiceIdFromEvent } from "@/lib/domain/stripe-webhook";

// Applies an already-verified Stripe event to our data. Stripe retries until it
// gets a 2xx, so the same event id arrives more than once: the processed-events
// ledger is checked (and written) first, which makes the whole handler
// exactly-once. Every outcome is a success — an event we don't act on is still
// acknowledged, because a non-2xx would make Stripe redeliver it forever. If two
// copies of one event ever race past the lookup, the ledger's primary key rejects
// the second insert: that delivery errors, Stripe retries, and the retry sees the
// ledger row — so the invoice is still only ever paid once.

export const INVOICE_PAID_EVENT = "invoice.paid";

export type StripeWebhookOutcome =
  "processed" | "duplicate" | "ignored_type" | "unknown_invoice" | "already_paid";

export interface StripeWebhookResult {
  eventId: string;
  outcome: StripeWebhookOutcome;
}

export async function processStripeEvent(
  repos: Repositories,
  event: StripeEvent,
  now: string = new Date().toISOString(),
): Promise<StripeWebhookResult> {
  const seen = await repos.processedStripeEvents.getById(event.id);
  if (seen) return { eventId: event.id, outcome: "duplicate" };
  await repos.processedStripeEvents.insert({ id: event.id, receivedAt: now });

  if (event.type !== INVOICE_PAID_EVENT) return { eventId: event.id, outcome: "ignored_type" };

  const invoiceId = invoiceIdFromEvent(event);
  const invoice = invoiceId ? await repos.invoices.getById(invoiceId) : null;
  if (!invoice) return { eventId: event.id, outcome: "unknown_invoice" };

  // The domain's transition table is the authority on what may become paid; an
  // already-paid (or void/refunded) invoice is left exactly as it is.
  if (!canTransitionInvoice(invoice.status as InvoiceStatus, "paid")) {
    return { eventId: event.id, outcome: "already_paid" };
  }

  await repos.invoices.update(invoice.id, { status: "paid", paidAt: now });
  return { eventId: event.id, outcome: "processed" };
}
