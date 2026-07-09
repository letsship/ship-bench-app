import { resolveRepositories } from "@/lib/db/repos";
import { stripeEnv } from "@/lib/env";
import { badRequest, handle, ok } from "@/lib/http";
import { handleStripeEvent, type StripeInvoicePaidEvent } from "@/lib/services/webhooks";
import { verifyStripeSignature } from "@/lib/webhooks/stripe-signature";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — Stripe is the caller, not a logged-in user, so
// the Stripe-Signature check below is the sole authentication; there is no
// requireSession()/resolveStudio() here.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    // Must read the raw text before any JSON parsing — signature verification
    // is computed over the exact bytes Stripe sent.
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("stripe-signature");
    const verified = await verifyStripeSignature(
      rawBody,
      signatureHeader,
      stripeEnv().STRIPE_WEBHOOK_SECRET,
    );
    if (!verified) return badRequest("Invalid Stripe signature");

    const event = JSON.parse(rawBody) as StripeInvoicePaidEvent;
    const repos = await resolveRepositories();
    await handleStripeEvent(repos, event);
    return ok({ received: true });
  });
}
