import { badRequest, handle, ok } from "@/lib/http";
import { constructStripeEvent, StripeSignatureError } from "@/lib/payments/stripe";
import { resolveStudio } from "@/lib/services/context";
import { handleStripeEvent } from "@/lib/services/webhooks";
import { stripeEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const rawBody = await request.text();
    const signature = request.headers.get("Stripe-Signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

    let payload: unknown;
    try {
      payload = await constructStripeEvent(rawBody, signature, secret);
    } catch (error) {
      if (error instanceof StripeSignatureError) return badRequest("Invalid Stripe signature");
      throw error;
    }

    const event = stripeEventSchema.parse(payload);
    const { repos } = await resolveStudio();
    await handleStripeEvent(repos, event);
    return ok({ received: true });
  });
}
