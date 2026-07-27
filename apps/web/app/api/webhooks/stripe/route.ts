import { resolveRepositories } from "@/lib/db/repos";
import { parseStripeEvent, verifyStripeSignature } from "@/lib/domain/stripe-webhook";
import { badRequest, handle, ok } from "@/lib/http";
import { applyStripeEvent } from "@/lib/services/stripe-webhooks";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — Stripe payment webhook. Verifies the
// Stripe-Signature header against STRIPE_WEBHOOK_SECRET before touching
// anything; on a verified invoice.paid event, marks the named invoice paid.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    // Signature covers the raw bytes, so read text — never request.json() first.
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret || !verifyStripeSignature(rawBody, signatureHeader, secret)) {
      return badRequest("Invalid Stripe signature");
    }

    const event = parseStripeEvent(rawBody);
    const repos = await resolveRepositories();
    await applyStripeEvent(repos, event);
    return ok({ received: true });
  });
}
