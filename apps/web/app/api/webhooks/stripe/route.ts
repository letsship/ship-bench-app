import type { NextRequest } from "next/server";
import { badRequest, handle, ok } from "@/lib/http";
import { resolveRepositories } from "@/lib/db/repos";
import { verifyStripeSignature } from "@/lib/domain/stripe-signature";
import { stripeWebhookEventSchema } from "@/lib/validation";
import { handleStripeEvent } from "@/lib/services/stripe-webhooks";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  return handle(async () => {
    // Read raw body first (required for signature verification)
    const rawBody = await request.text();

    // Extract and verify signature
    const stripeSignature = request.headers.get("stripe-signature");
    if (!stripeSignature) {
      return badRequest("Missing Stripe-Signature header");
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return badRequest("Webhook signing secret not configured");
    }

    const isValid = await verifyStripeSignature({
      payload: rawBody,
      header: stripeSignature,
      secret: webhookSecret,
    });

    if (!isValid) {
      return badRequest("Invalid Stripe signature");
    }

    // Parse and validate the webhook event
    const event = stripeWebhookEventSchema.parse(JSON.parse(rawBody));

    // Handle the event
    const repos = await resolveRepositories();
    await handleStripeEvent(repos, event);

    return ok({ received: true });
  });
}
