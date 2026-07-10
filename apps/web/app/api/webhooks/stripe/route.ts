import { resolveRepositories } from "@/lib/db/repos";
import { verifyStripeSignature } from "@/lib/domain/stripe-webhook";
import { stripeWebhookSecret } from "@/lib/env";
import { apiError, handle, ok } from "@/lib/http";
import { processStripeWebhookEvent } from "@/lib/services/stripe-webhook";
import { stripeEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — unauthenticated (Stripe calls this directly); the
// Stripe-Signature header IS the auth. The raw body is read and verified
// BEFORE any parsing, since re-serializing JSON would break signature
// verification. https://docs.stripe.com/webhooks#verify-events
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("Stripe-Signature");
  const verified = await verifyStripeSignature(rawBody, signature, stripeWebhookSecret());
  if (!verified) {
    return apiError(400, "invalid_signature", "Invalid or missing Stripe-Signature header");
  }

  return handle(async () => {
    const event = stripeEventSchema.parse(JSON.parse(rawBody));
    const repos = await resolveRepositories();
    await processStripeWebhookEvent(repos, event);
    return ok({ received: true });
  });
}
