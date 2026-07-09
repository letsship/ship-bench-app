import { resolveRepositories } from "@/lib/db/repos";
import { badRequest, handle, ok } from "@/lib/http";
import { verifyStripeSignature } from "@/lib/payments/stripe";
import { handleStripeWebhookEvent } from "@/lib/services/webhooks";
import { stripeWebhookEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — Stripe payment webhook. Authenticated by the
// Stripe-Signature header (there is no session cookie to check: Stripe can't
// send ours), so verification MUST run over the exact raw bytes Stripe
// signed, before any JSON parsing happens. Every verified request gets a 200
// regardless of what it did, per Stripe's retry semantics — a non-2xx means
// Stripe will redeliver.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const rawBody = await request.text();
    const signature = request.headers.get("Stripe-Signature");
    const verified = await verifyStripeSignature(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
    if (!verified) return badRequest("Invalid or missing Stripe-Signature");

    const event = stripeWebhookEventSchema.parse(JSON.parse(rawBody));
    const repos = await resolveRepositories();
    await handleStripeWebhookEvent(repos, event);
    return ok({ received: true });
  });
}
