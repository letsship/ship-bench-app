import { resolveRepositories } from "@/lib/db/repos";
import { stripeWebhookSecret } from "@/lib/env";
import { HttpError, handle, ok } from "@/lib/http";
import { processStripeWebhookEvent } from "@/lib/services/stripe-webhooks";
import { verifyAndParseStripeEvent } from "@/lib/stripe/webhook";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — Stripe payment webhook. Verifies the
// Stripe-Signature header against STRIPE_WEBHOOK_SECRET before touching
// anything, then marks the named invoice paid on `invoice.paid`. Unauthenticated
// (Stripe is an external caller) and idempotent (repeated event ids are no-ops).
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const secret = stripeWebhookSecret();
    if (!secret) throw new HttpError(400, "bad_request", "Stripe webhooks are not configured");

    const rawBody = await request.text();
    const signatureHeader = request.headers.get("stripe-signature");
    const event = await verifyAndParseStripeEvent(rawBody, signatureHeader, secret);

    const repos = await resolveRepositories();
    const result = await processStripeWebhookEvent(repos, event);
    return ok(result);
  });
}
