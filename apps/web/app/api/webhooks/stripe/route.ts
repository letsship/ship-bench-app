import { resolveRepositories } from "@/lib/db/repos";
import { verifyStripeSignature } from "@/lib/domain/stripe-webhook";
import { stripeWebhookSecret } from "@/lib/env";
import { badRequest, handle, ok } from "@/lib/http";
import { handleStripeInvoiceWebhook } from "@/lib/services/webhooks";
import { stripeEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — Stripe webhook receiver. Unauthenticated: trust
// comes from verifying the Stripe-Signature header over the EXACT raw bytes,
// so the body is read with request.text() and never request.json(). No session
// and no studio scope — the event names its target invoice directly.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!verifyStripeSignature(rawBody, signature, stripeWebhookSecret())) {
      return badRequest("Invalid Stripe signature");
    }
    const event = stripeEventSchema.parse(JSON.parse(rawBody));
    await handleStripeInvoiceWebhook(await resolveRepositories(), event);
    return ok({ received: true });
  });
}
