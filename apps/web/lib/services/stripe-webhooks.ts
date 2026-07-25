import type { Repositories } from "@/lib/db/repos/types";
import type { StripeWebhookEvent } from "@/lib/validation";

export interface ProcessEventResult {
  handled: boolean;
}

export async function processStripeEvent(
  repos: Repositories,
  event: StripeWebhookEvent,
): Promise<ProcessEventResult> {
  if (event.type !== "invoice.paid") {
    return { handled: false };
  }

  const invoiceId = event.data?.object?.metadata?.invoice_id;
  if (!invoiceId) {
    return { handled: false };
  }

  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice) {
    return { handled: false };
  }

  if (invoice.status === "paid") {
    return { handled: false };
  }

  await repos.invoices.update(invoiceId, {
    status: "paid",
    paidAt: new Date().toISOString(),
  });

  return { handled: true };
}
