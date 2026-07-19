import type { Repositories } from "@/lib/db/repos/types";
import { invoiceIdFromEvent, type StripeEvent } from "@/lib/domain/stripe-webhook";

export async function processStripeEvent(repos: Repositories, event: StripeEvent): Promise<void> {
  if (event.type !== "invoice.paid") {
    return;
  }

  const invoiceId = invoiceIdFromEvent(event);
  if (!invoiceId) {
    return;
  }

  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice) {
    return;
  }

  if (invoice.status === "paid") {
    return;
  }

  if (invoice.status === "open") {
    await repos.invoices.update(invoiceId, {
      status: "paid",
      paidAt: new Date().toISOString(),
    });
  }
}
