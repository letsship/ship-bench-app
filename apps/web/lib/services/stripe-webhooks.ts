import type { Repositories } from "@/lib/db/repos/types";
import { getInvoiceIdFromEvent } from "@/lib/domain/stripe-webhook";
import type { StripeEvent } from "@/lib/validation";

export async function processStripeEvent(repos: Repositories, event: StripeEvent): Promise<void> {
  const already = await repos.webhookEvents.getById(event.id);
  if (already) return;

  if (event.type !== "invoice.paid") {
    await repos.webhookEvents.insert({
      id: event.id,
      type: event.type,
      receivedAt: new Date().toISOString(),
    });
    return;
  }

  const invoiceId = getInvoiceIdFromEvent(event);
  if (!invoiceId) {
    await repos.webhookEvents.insert({
      id: event.id,
      type: event.type,
      receivedAt: new Date().toISOString(),
    });
    return;
  }

  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice) {
    await repos.webhookEvents.insert({
      id: event.id,
      type: event.type,
      receivedAt: new Date().toISOString(),
    });
    return;
  }

  if (invoice.status !== "paid") {
    const now = new Date().toISOString();
    await repos.invoices.update(invoiceId, { status: "paid", paidAt: now });
  }

  await repos.webhookEvents.insert({
    id: event.id,
    type: event.type,
    receivedAt: new Date().toISOString(),
  });
}
