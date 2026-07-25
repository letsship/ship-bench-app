import type { Repositories } from "@/lib/db/repos/types";
import type { StripeWebhookEvent } from "@/lib/validation";

export type HandleStripeEventOutcome = "paid" | "already_paid" | "unknown_invoice" | "ignored_type";

export interface HandleStripeEventResult {
  outcome: HandleStripeEventOutcome;
}

export async function handleStripeEvent(
  repos: Repositories,
  event: StripeWebhookEvent,
): Promise<HandleStripeEventResult> {
  if (event.type !== "invoice.paid") {
    return { outcome: "ignored_type" };
  }

  const invoiceId = event.data?.object?.metadata?.invoice_id;
  if (!invoiceId) {
    return { outcome: "unknown_invoice" };
  }

  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice) {
    return { outcome: "unknown_invoice" };
  }

  if (invoice.status === "paid") {
    return { outcome: "already_paid" };
  }

  const paidAt = new Date().toISOString();
  await repos.invoices.update(invoiceId, { status: "paid", paidAt });

  return { outcome: "paid" };
}
