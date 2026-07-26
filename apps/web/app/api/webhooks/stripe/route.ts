import { resolveRepositories } from "@/lib/db/repos";
import { verifyStripeSignature } from "@/lib/domain/stripe-signature";
import { stripeWebhookSecret } from "@/lib/env";
import { badRequest, handle, ok } from "@/lib/http";
import { type StripeEvent, applyStripeEvent } from "@/lib/services/stripe-webhooks";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — receives Stripe payment webhooks. No
// requireSession: Stripe calls this unauthenticated, so the signature IS the
// auth. The signature covers the raw body, so it must be read with
// request.text() and verified BEFORE any JSON.parse.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("stripe-signature");
    const secret = stripeWebhookSecret();

    if (!secret || !(await verifyStripeSignature(rawBody, signatureHeader, secret))) {
      return badRequest("Invalid Stripe signature");
    }

    const event = JSON.parse(rawBody) as StripeEvent;
    const repos = await resolveRepositories();
    await applyStripeEvent(repos, event, new Date());
    return ok({ received: true });
  });
}
