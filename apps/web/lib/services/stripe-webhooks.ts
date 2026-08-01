import type { Repositories } from "@/lib/db/repos/types";
import type { StripeWebhookEvent } from "@/lib/validation";

export type StripeWebhookResult = "ignored" | "marked_paid";

export async function processStripeWebhook(
  repos: Repositories,
  event: StripeWebhookEvent,
): Promise<StripeWebhookResult> {
  if (event.type !== "invoice.paid") return "ignored";

  const invoiceId = event.data.object.metadata?.invoice_id;
  if (!invoiceId) return "ignored";

  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice || invoice.status === "paid") return "ignored";

  await repos.invoices.update(invoiceId, {
    status: "paid",
    paidAt: new Date().toISOString(),
  });
  return "marked_paid";
}
