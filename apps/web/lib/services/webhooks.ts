import type { Repositories } from "@/lib/db/repos/types";
import { stripeWebhookEventSchema } from "@/lib/validation";
import { markInvoicePaidFromWebhook } from "./invoices";

// Routes a verified Stripe webhook event to the matching domain action. Any
// event type other than `invoice.paid` (or one missing the invoice metadata we
// rely on) is acknowledged and ignored.
export async function handleStripeEvent(repos: Repositories, event: unknown): Promise<void> {
  const parsed = stripeWebhookEventSchema.safeParse(event);
  if (!parsed.success) return;

  const { type, data } = parsed.data;
  if (type !== "invoice.paid") return;

  const invoiceId = data.object.metadata?.invoice_id;
  if (!invoiceId) return;

  await markInvoicePaidFromWebhook(repos, invoiceId);
}
