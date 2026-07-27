import type { Repositories } from "@/lib/db/repos/types";
import type { StripeEvent } from "@/lib/domain/stripe-webhook";

export interface ApplyStripeEventResult {
  applied: boolean;
}

// Applies a verified Stripe event. Only invoice.paid is acted on; every other
// event type is acknowledged and ignored. An unknown or already-paid invoice
// is a no-op — the latter is what makes a replayed event idempotent, since
// paidAt is left untouched rather than reset to "now".
export async function applyStripeEvent(
  repos: Repositories,
  event: StripeEvent,
): Promise<ApplyStripeEventResult> {
  if (event.type !== "invoice.paid" || !event.invoiceId) {
    return { applied: false };
  }

  const invoice = await repos.invoices.getById(event.invoiceId);
  if (!invoice || invoice.status === "paid") {
    return { applied: false };
  }

  await repos.invoices.update(invoice.id, { status: "paid", paidAt: new Date().toISOString() });
  return { applied: true };
}
