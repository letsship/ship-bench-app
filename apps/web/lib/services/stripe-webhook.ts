import type { Repositories } from "@/lib/db/repos/types";
import { HttpError } from "@/lib/http";
import { stripeEventSchema } from "@/lib/validation";
import { verifyStripeSignature } from "@/lib/domain/stripe-webhook";

// Stripe webhook processing: verify signature, validate event, deduplicate by
// event id, and mark invoice paid if it's an invoice.paid event.

export async function processStripeWebhook(
  repos: Repositories,
  {
    payload,
    header,
    secret,
  }: {
    payload: string;
    header: string | undefined;
    secret: string | undefined;
  },
): Promise<void> {
  // (1) Verify signature
  if (!verifyStripeSignature({ payload, header, secret })) {
    throw new HttpError(400, "bad_request", "Invalid signature");
  }

  // (2) Validate the event
  const event = stripeEventSchema.parse(JSON.parse(payload));

  // (3) Idempotency — check if already processed
  const existing = await repos.webhookEvents.getById(event.id);
  if (existing) {
    // Already processed; acknowledge with no mutation
    return;
  }

  // (4) Handle only invoice.paid events
  if (event.type !== "invoice.paid") {
    // Acknowledge other event types with no change
    await repos.webhookEvents.insert({
      id: event.id,
      type: event.type,
      receivedAt: new Date().toISOString(),
    });
    return;
  }

  // (5) Get the invoice ID from the event metadata
  const invoiceId = event.data?.object?.metadata?.invoice_id;
  if (!invoiceId) {
    // No invoice ID in the event; acknowledge with no change
    await repos.webhookEvents.insert({
      id: event.id,
      type: event.type,
      receivedAt: new Date().toISOString(),
    });
    return;
  }

  // (6) Find and mark the invoice as paid
  const invoice = await repos.invoices.getById(invoiceId);
  if (!invoice) {
    // Unknown invoice; acknowledge with no change
    await repos.webhookEvents.insert({
      id: event.id,
      type: event.type,
      receivedAt: new Date().toISOString(),
    });
    return;
  }

  // Mark paid only if not already paid
  if (invoice.status !== "paid") {
    await repos.invoices.update(invoiceId, {
      status: "paid",
      paidAt: new Date().toISOString(),
    });
  }

  // (7) Record the processed event
  await repos.webhookEvents.insert({
    id: event.id,
    type: event.type,
    receivedAt: new Date().toISOString(),
  });
}
