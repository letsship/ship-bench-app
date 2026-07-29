import type { Repositories } from "@/lib/db/repos/types";
import type { StripeEvent } from "@/lib/validation";

// Webhook handlers composing repositories (injected) — no framework, request,
// or signature concerns here; the route verifies authenticity before calling.

export interface StripeWebhookResult {
  handled: boolean;
}

// Handle a verified Stripe event. Only `invoice.paid` changes state: the
// invoice named at data.object.metadata.invoice_id moves open→paid with
// paidAt set. Everything else (other types, missing metadata, unknown
// invoice) is acknowledged with no change so Stripe stops retrying.
//
// Idempotency: an already-paid invoice is a no-op (paidAt is NOT rewritten).
// An invoice crosses open→paid at most once, so Stripe's at-least-once
// delivery of the same event id leaves it paid exactly once.
export async function handleStripeInvoiceWebhook(
  repos: Repositories,
  event: StripeEvent,
): Promise<StripeWebhookResult> {
  if (event.type !== "invoice.paid") return { handled: false };
  const invoiceId = event.data?.object?.metadata?.invoice_id;
  if (!invoiceId) return { handled: false };
  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice || invoice.status === "paid") return { handled: false };
  await repos.invoices.update(invoiceId, {
    status: "paid",
    paidAt: new Date().toISOString(),
  });
  return { handled: true };
}
