import { handle, HttpError, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { processStripeEvent } from "@/lib/services/stripe-webhook";
import { verifyStripeSignature } from "@/lib/stripe/webhook";
import { serverEnv } from "@/lib/env";
import { stripeEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    // Read the raw body (signature is over raw bytes).
    const rawBody = await request.text();

    // Read the signature header.
    const signatureHeader = request.headers.get("stripe-signature");
    if (!signatureHeader) {
      throw new HttpError(400, "bad_request", "Missing Stripe-Signature header");
    }

    // Load the webhook secret from environment.
    const env = serverEnv();
    const secret = env.STRIPE_WEBHOOK_SECRET;

    // Verify the signature.
    const isValid = await verifyStripeSignature(rawBody, signatureHeader, secret);
    if (!isValid) {
      throw new HttpError(400, "bad_request", "Invalid Stripe signature");
    }

    // Parse the event.
    const event = stripeEventSchema.parse(JSON.parse(rawBody));

    // Process the event.
    const { repos } = await resolveStudio();
    await processStripeEvent(repos, event);

    return ok({ received: true });
  });
}
