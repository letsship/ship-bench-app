import { badRequest, handle, ok } from "@/lib/http";
import { verifyStripeSignature } from "@/lib/domain/stripe-webhook";
import { stripeEventSchema } from "@/lib/validation";
import { processStripeEvent } from "@/lib/services/stripe-webhooks";
import { resolveRepositories } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("stripe-signature") ?? undefined;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      return badRequest("Stripe webhook secret not configured");
    }

    const valid = await verifyStripeSignature(rawBody, signatureHeader, secret);
    if (!valid) {
      return badRequest("Invalid or missing Stripe signature");
    }

    const event = stripeEventSchema.parse(JSON.parse(rawBody));
    const repos = await resolveRepositories();
    await processStripeEvent(repos, event);

    return ok({ received: true });
  });
}
