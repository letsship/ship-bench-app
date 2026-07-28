import type { Repositories } from "@/lib/db/repos/types";
import { extractInvoiceId, verifyStripeSignature } from "@/lib/domain/stripe-webhook";
import { HttpError } from "@/lib/http";
import { stripeEventSchema } from "@/lib/validation";

// Processes a Stripe webhook delivery. The signature is verified FIRST — on a
// missing header or bad signature we throw 400 before touching any repository,
// so a forged request changes nothing. Idempotency is keyed on the invoice's
// paid-state: a re-delivered event finds the invoice already paid and no-ops.

export interface StripeWebhookInput {
  payload: string;
  signatureHeader: string | null;
  secret: string;
  nowMs: number;
}

export interface StripeWebhookResult {
  received: true;
}

export async function processStripeWebhook(
  repos: Repositories,
  input: StripeWebhookInput,
): Promise<StripeWebhookResult> {
  const verified = verifyStripeSignature({
    payload: input.payload,
    header: input.signatureHeader,
    secret: input.secret,
    nowMs: input.nowMs,
  });
  if (!verified) {
    throw new HttpError(400, "bad_request", "Invalid Stripe signature");
  }

  const event = stripeEventSchema.parse(JSON.parse(input.payload));
  if (event.type !== "invoice.paid") return { received: true };

  const invoiceId = extractInvoiceId(event);
  if (!invoiceId) return { received: true };

  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice || invoice.status === "paid") return { received: true };

  await repos.invoices.update(invoiceId, {
    status: "paid",
    paidAt: new Date(input.nowMs).toISOString(),
  });
  return { received: true };
}
