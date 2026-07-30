import { resolveRepositories } from "@/lib/db/repos";
import { verifyStripeWebhook } from "@/lib/domain/stripe-webhook";
import { stripeWebhookSecret } from "@/lib/env";
import { badRequest, handle, ok } from "@/lib/http";
import { processStripeEvent } from "@/lib/services/stripe-webhooks";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — Stripe payment webhooks. No session auth: Stripe
// cannot send cookies, so the Stripe-Signature header IS the authentication.
// Anything we cannot verify against STRIPE_WEBHOOK_SECRET is rejected with 400
// and changes nothing; everything verified is acknowledged with 200 (a non-2xx
// makes Stripe redeliver), and the service keeps redeliveries idempotent.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const secret = stripeWebhookSecret();
    if (!secret) {
      console.error("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set");
      return badRequest("Stripe webhooks are not configured");
    }

    // The RAW body, never request.json(): the signature covers these exact bytes.
    const payload = await request.text();
    const event = await verifyStripeWebhook({
      payload,
      header: request.headers.get("stripe-signature"),
      secret,
    });
    if (!event) return badRequest("Invalid Stripe signature");

    const result = await processStripeEvent(await resolveRepositories(), event);
    return ok({ received: true, ...result });
  });
}
