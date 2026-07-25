import { badRequest, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { processStripeEvent } from "@/lib/services/stripe-webhooks";
import { verifyStripeSignature } from "@/lib/domain/stripe-webhook";
import { stripeWebhookEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const signatureHeader = request.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    }

    if (!signatureHeader) {
      return badRequest("Missing Stripe-Signature header");
    }

    const body = await request.text();
    const isValid = await verifyStripeSignature(body, signatureHeader, secret, Date.now());

    if (!isValid) {
      return badRequest("Invalid signature");
    }

    const event = stripeWebhookEventSchema.parse(JSON.parse(body));
    const { repos } = await resolveStudio();
    await processStripeEvent(repos, event);

    return ok({ received: true });
  });
}
