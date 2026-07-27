import type { Repositories } from "@/lib/db/repos/types";
import { type InvoiceStatus, canTransitionInvoice } from "@/lib/domain/invoices";
import { extractInvoiceId, isInvoicePaidEvent } from "@/lib/domain/stripe-webhook";
import type { StripeWebhookEventInput } from "@/lib/validation";

// Applies an already-verified Stripe event. Stripe redelivers events, so every
// processed event id is recorded in a ledger and a repeat delivery does nothing.
// Nothing here throws for business reasons: a webhook must be acknowledged, not
// errored — which is why it does not reuse updateInvoiceStatus (that returns a
// 409 for a non-transitionable invoice).

export interface StripeEventOutcome {
  handled: boolean;
  duplicate: boolean;
  invoiceId: string | null;
}

const unchanged = (invoiceId: string | null = null): StripeEventOutcome => ({
  handled: false,
  duplicate: false,
  invoiceId,
});

async function markInvoicePaid(
  repos: Repositories,
  invoiceId: string,
  paidAt: string,
): Promise<StripeEventOutcome> {
  const invoice = await repos.invoices.getById(invoiceId);
  // An unknown invoice, or one already paid/void/refunded, is acknowledged as-is.
  if (!invoice || !canTransitionInvoice(invoice.status as InvoiceStatus, "paid")) {
    return unchanged(invoiceId);
  }
  await repos.invoices.update(invoiceId, { status: "paid", paidAt });
  return { handled: true, duplicate: false, invoiceId };
}

export async function processStripeEvent(
  repos: Repositories,
  event: StripeWebhookEventInput,
): Promise<StripeEventOutcome> {
  if (await repos.webhookEvents.has(event.id)) {
    return { handled: false, duplicate: true, invoiceId: null };
  }

  const processedAt = new Date().toISOString();
  const invoiceId = isInvoicePaidEvent(event) ? extractInvoiceId(event) : null;
  const outcome = invoiceId
    ? await markInvoicePaid(repos, invoiceId, processedAt)
    : unchanged(invoiceId);

  // Recorded even for event types we ignore, so replays stay cheap no-ops.
  await repos.webhookEvents.insert({ id: event.id, processedAt });
  return outcome;
}
