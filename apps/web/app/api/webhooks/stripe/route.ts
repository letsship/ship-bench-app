import { resolveRepositories } from "@/lib/db/repos";
import { verifyStripeSignature } from "@/lib/domain/stripe-webhook";
import { serverEnv } from "@/lib/env";
import { badRequest, handle, ok } from "@/lib/http";
import { processStripeWebhookEvent } from "@/lib/services/stripe-webhooks";
import { stripeWebhookEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — Stripe event delivery. Authenticated by the
// Stripe-Signature header (HMAC over the raw body), not by a user session, so
// no requireSession(). The raw text MUST be read before any JSON parsing —
// signature verification covers the exact bytes Stripe sent.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    const secret = serverEnv().STRIPE_WEBHOOK_SECRET;
    if (!secret || !verifyStripeSignature(rawBody, signature, secret)) {
      return badRequest("Invalid Stripe signature");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return badRequest("Invalid JSON payload");
    }
    const event = stripeWebhookEventSchema.parse(payload);

    const repos = await resolveRepositories();
    await processStripeWebhookEvent(repos, event);
    return ok({ received: true });
  });
}
