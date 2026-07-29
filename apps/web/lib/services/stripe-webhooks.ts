import type { Repositories } from "@/lib/db/repos/types";
import type { StripeEvent } from "@/lib/validation";

export async function handleStripeEvent(
  repos: Repositories,
  event: StripeEvent,
): Promise<void> {
  if (event.type !== "invoice.paid") {
    return;
  }

  const invoiceId = event.data.object.metadata?.invoice_id;
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

  await repos.invoices.update(invoiceId, {
    status: "paid",
    paidAt: new Date().toISOString(),
  });
}