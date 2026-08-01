import { badRequest, handle, ok } from "@/lib/http";
import { resolveStudio } from "@/lib/services/context";
import { processStripeWebhook } from "@/lib/services/stripe-webhooks";
import { verifyStripeSignature } from "@/lib/webhooks/stripe";
import { stripeWebhookEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const rawBody = await request.text();
    const signature = request.headers.get("Stripe-Signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    if (!(await verifyStripeSignature(rawBody, signature, secret))) {
      return badRequest("Invalid Stripe signature");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return badRequest("Invalid JSON body");
    }
    const event = stripeWebhookEventSchema.parse(payload);
    const { repos } = await resolveStudio();
    await processStripeWebhook(repos, event);
    return ok({ received: true });
  });
}
