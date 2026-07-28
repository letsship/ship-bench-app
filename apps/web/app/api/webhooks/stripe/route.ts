// POST /api/webhooks/stripe — receive Stripe payment webhooks, verify the
// signature, and mark the matching invoice paid. NOT session-guarded: Stripe
// POSTs to us directly, so authenticity comes from the Stripe-Signature HMAC.
//
// The raw body is read byte-for-byte via request.text() before any JSON
// parsing, because the signature is computed over the raw bytes — reading as
// JSON then re-serializing could change them.

import type { NextRequest } from "next/server";
import { badRequest, handle, ok } from "@/lib/http";
import { verifyStripeSignature } from "@/lib/domain/stripe-webhook";
import { resolveRepositories } from "@/lib/db/repos";
import { handleStripeEvent } from "@/lib/services/stripe-webhook";
import { stripeWebhookEventSchema } from "@/lib/validation";
import { stripeWebhookSecret } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  return handle(async () => {
    // Read the raw body BEFORE any JSON ops — the HMAC is over the raw bytes.
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    const secret = stripeWebhookSecret();

    if (!secret || !signature) {
      return badRequest("Missing Stripe webhook secret or signature header");
    }

    const valid = await verifyStripeSignature(rawBody, signature, secret);
    if (!valid) {
      return badRequest("Invalid Stripe signature");
    }

    // Now parse the verified JSON payload.
    const payload = JSON.parse(rawBody);
    const event = stripeWebhookEventSchema.parse(payload);

    const repos = await resolveRepositories();
    await handleStripeEvent(repos, event);

    return ok({ received: true });
  });
}