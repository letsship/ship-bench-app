import { resolveRepositories } from "@/lib/db/repos";
import { HttpError, handle, ok } from "@/lib/http";
import { handleStripeEvent } from "@/lib/services/webhooks";
import { verifyStripeSignature } from "@/lib/webhooks/stripe";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — receives Stripe payment webhooks. Verifies the
// Stripe-Signature header before touching any state (docs.stripe.com/webhooks
// #verify-events); a genuine `invoice.paid` event marks the named invoice paid.
// No session is required — Stripe, not an operator, is the caller.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("Stripe-Signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

    const verified = await verifyStripeSignature(rawBody, signatureHeader, secret);
    if (!verified) {
      throw new HttpError(400, "bad_request", "Invalid Stripe signature");
    }

    const event: unknown = JSON.parse(rawBody);
    const repos = await resolveRepositories();
    await handleStripeEvent(repos, event);

    return ok({ received: true });
  });
}
