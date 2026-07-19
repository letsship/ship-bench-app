import type { NextRequest } from "next/server";
import { handle, badRequest, ok } from "@/lib/http";
import { resolveRepositories } from "@/lib/db/repos";
import { serverEnv } from "@/lib/env";
import { verifyStripeSignature } from "@/lib/domain/stripe";
import { stripeWebhookEventSchema } from "@/lib/validation";
import { processStripeEvent } from "@/lib/services/stripe-webhooks";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  return handle(async () => {
    // Read the raw body for HMAC verification.
    const rawBody = await request.text();

    // Read the signature header and secret.
    const signatureHeader = request.headers.get("Stripe-Signature");
    const env = serverEnv();

    // Return 400 if the secret is unset or the signature is invalid.
    if (!env.STRIPE_WEBHOOK_SECRET) {
      return badRequest("Stripe webhook secret not configured");
    }

    if (!signatureHeader) {
      return badRequest("Missing Stripe-Signature header");
    }

    const isValid = await verifyStripeSignature(
      rawBody,
      signatureHeader,
      env.STRIPE_WEBHOOK_SECRET,
    );

    if (!isValid) {
      return badRequest("Invalid Stripe-Signature");
    }

    // Parse and validate the event.
    const event = stripeWebhookEventSchema.parse(JSON.parse(rawBody));

    // Resolve repositories (no requireSession — caller is Stripe, not a signed-in user).
    const repos = await resolveRepositories();

    // Process the event.
    await processStripeEvent(repos, event);

    return ok({ status: "received" });
  });
}
