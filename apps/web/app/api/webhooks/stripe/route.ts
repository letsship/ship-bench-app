import { badRequest, handle, ok } from "@/lib/http";
import { resolveRepositories } from "@/lib/db/repos";
import { serverEnv } from "@/lib/env";
import { handleStripeEvent } from "@/lib/services/webhooks";
import { stripeEventSchema } from "@/lib/validation";
import { verifyStripeSignature } from "@/lib/webhooks/stripe-signature";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — receive a Stripe webhook. The raw body is read
// with request.text() (NEVER request.json() first — the signature is over the
// exact bytes) and verified against STRIPE_WEBHOOK_SECRET. A missing or invalid
// Stripe-Signature is rejected with 400 and nothing changes. A verified event
// is dispatched to the service (which is idempotent by Stripe event id).
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const rawBody = await request.text();
    const signature = request.headers.get("Stripe-Signature");
    const secret = serverEnv().STRIPE_WEBHOOK_SECRET;

    if (!secret || !(await verifyStripeSignature(rawBody, signature, secret))) {
      return badRequest("Invalid Stripe signature");
    }

    const event = stripeEventSchema.parse(JSON.parse(rawBody));
    const repos = await resolveRepositories();
    await handleStripeEvent(repos, event);
    return ok({ received: true });
  });
}
