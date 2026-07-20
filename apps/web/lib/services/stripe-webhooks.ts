import type { Repositories } from "@/lib/db/repos/types";
import type { StripeEvent } from "@/lib/domain/stripe-webhook";

export type StripeEventOutcome = "paid" | "already_paid" | "unknown_invoice" | "ignored";

export interface StripeEventResult {
  outcome: StripeEventOutcome;
}

export async function handleStripeEvent(
  repos: Repositories,
  event: StripeEvent,
): Promise<StripeEventResult> {
  if (event.type !== "invoice.paid") {
    return { outcome: "ignored" };
  }

  const invoiceId = event.data.object.metadata?.invoice_id;
  if (!invoiceId) {
    return { outcome: "ignored" };
  }

  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice) {
    return { outcome: "unknown_invoice" };
  }

  if (invoice.status === "paid") {
    return { outcome: "already_paid" };
  }

  await repos.invoices.update(invoiceId, {
    status: "paid",
    paidAt: new Date().toISOString(),
  });

  return { outcome: "paid" };
}
