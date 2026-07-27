import { resolveRepositories } from "@/lib/db/repos";
import { verifyStripeSignature } from "@/lib/domain/stripe-webhook";
import { stripeWebhookSecret } from "@/lib/env";
import { HttpError, badRequest, handle, ok } from "@/lib/http";
import { processStripeEvent } from "@/lib/services/stripe-webhooks";
import { stripeWebhookEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// A verified body that is not JSON is a client error, never a 500.
function parseJsonBody(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch (error) {
    console.error("Stripe webhook body was not valid JSON", error);
    throw new HttpError(400, "bad_request", "Malformed JSON body");
  }
}

// POST /api/webhooks/stripe — Stripe payment notifications. Unauthenticated by
// design (Stripe carries no session): the `Stripe-Signature` header IS the
// authentication, so the raw body is read and verified BEFORE it is parsed, and
// an unverified request is rejected without touching any data.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const payload = await request.text();
    const verified = await verifyStripeSignature({
      payload,
      header: request.headers.get("stripe-signature"),
      secret: stripeWebhookSecret(),
    });
    if (!verified) return badRequest("Invalid Stripe signature");

    const event = stripeWebhookEventSchema.parse(parseJsonBody(payload));
    const repos = await resolveRepositories();
    await processStripeEvent(repos, event);
    // Always 200 once verified — Stripe retries anything else, and an event we
    // do not act on (unknown invoice, other type, replay) is still received.
    return ok({ received: true });
  });
}
