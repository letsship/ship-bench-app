import type { Repositories } from "@/lib/db/repos/types";

// Composes repositories by DI (no module singletons), matching the other
// `lib/services/` modules. Only `invoice.paid` mutates anything; every other
// event, and every event naming an invoice we don't recognise, is acknowledged
// with no change so the caller can always respond 200.

export interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      metadata?: Record<string, string | undefined> | null;
    };
  };
}

export type StripeWebhookResult = "marked" | "already-paid" | "unknown-invoice" | "ignored";

// Idempotent by invoice state rather than by event id: a redelivered
// `invoice.paid` finds the invoice already `paid` and returns without
// rewriting, so `paidAt` is set exactly once no matter how many times Stripe
// resends the same event.
export async function applyStripeEvent(
  repos: Repositories,
  event: StripeEvent,
  now: Date,
): Promise<StripeWebhookResult> {
  if (event.type !== "invoice.paid") return "ignored";

  const invoiceId = event.data.object.metadata?.invoice_id;
  if (!invoiceId) return "unknown-invoice";

  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice) return "unknown-invoice";
  if (invoice.status === "paid") return "already-paid";

  await repos.invoices.update(invoiceId, { status: "paid", paidAt: now.toISOString() });
  return "marked";
}
