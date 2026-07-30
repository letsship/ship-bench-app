import type { Repositories } from "@/lib/db/repos/types";
import { stripeInvoiceId, stripeEventType } from "@/lib/domain/stripe-webhook";
import type { StripeEvent } from "@/lib/validation";

export const INVOICE_PAID = "invoice.paid";

export type StripeEventOutcome = "ignored" | "marked-paid" | "already-paid" | "unknown-invoice";

// Apply a verified Stripe event to the repository seam. Always acknowledges
// (returns a result, never throws) so the route can answer 200 to Stripe and
// stop it retrying. Idempotency: a re-delivered `invoice.paid` (same event id)
// finds the invoice already `paid` from the first delivery and changes nothing.
export async function processStripeEvent(
  repos: Repositories,
  event: StripeEvent,
): Promise<StripeEventOutcome> {
  if (stripeEventType(event) !== INVOICE_PAID) return "ignored";
  const invoiceId = stripeInvoiceId(event);
  if (!invoiceId) return "ignored";
  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice) return "unknown-invoice";
  if (invoice.status === "paid") return "already-paid";
  await repos.invoices.update(invoiceId, {
    status: "paid",
    paidAt: new Date().toISOString(),
  });
  return "marked-paid";
}
