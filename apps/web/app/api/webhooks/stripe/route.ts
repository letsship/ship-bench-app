import { resolveRepositories } from "@/lib/db/repos";
import { HttpError, handle, ok } from "@/lib/http";
import { processStripeEvent } from "@/lib/services/stripe-webhooks";
import { verifyStripeWebhook } from "@/lib/stripe/webhook";
import { stripeEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — Stripe payment webhook. No session: the caller is
// Stripe, authenticated by the signature over the raw body. Anything that fails
// verification is rejected with 400 before any read or write.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const rawBody = await request.text();
    const event = await verifyStripeWebhook(
      rawBody,
      request.headers.get("stripe-signature"),
      process.env.STRIPE_WEBHOOK_SECRET ?? "",
    );
    if (event === null) {
      throw new HttpError(400, "invalid_signature", "Missing or invalid Stripe signature");
    }
    const repos = await resolveRepositories();
    return ok(await processStripeEvent(repos, stripeEventSchema.parse(event)));
  });
}
