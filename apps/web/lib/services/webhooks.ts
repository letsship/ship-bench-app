import type { Repositories } from "@/lib/db/repos/types";
import type { StripeEvent } from "@/lib/webhooks/stripe";

export async function handleStripeEvent(repos: Repositories, event: StripeEvent): Promise<void> {
  if (await repos.webhookEvents.getById(event.id)) return;

  const invoiceId = event.data.object.metadata.invoice_id;
  if (event.type === "invoice.paid" && invoiceId) {
    const invoice = await repos.invoices.getById(invoiceId);
    if (invoice && invoice.status !== "paid") {
      await repos.invoices.update(invoice.id, { status: "paid", paidAt: new Date().toISOString() });
    }
  }

  await repos.webhookEvents.insert({
    id: event.id,
    type: event.type,
    processedAt: new Date().toISOString(),
  });
}
