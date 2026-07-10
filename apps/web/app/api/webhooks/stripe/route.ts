import { resolveRepositories } from "@/lib/db/repos";
import { verifyStripeSignature } from "@/lib/domain/stripe-webhooks";
import { badRequest, handle, ok } from "@/lib/http";
import { processStripeWebhookEvent } from "@/lib/services/stripe-webhooks";
import { stripeWebhookEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — receives Stripe payment webhooks and marks the
// named invoice paid. Public and signature-authenticated (like /api/ical):
// Stripe calls this directly, not a signed-in operator, so there is no
// requireSession() here — trust comes entirely from the verified signature.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const payload = await request.text();
    const signature = request.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const verified = secret ? await verifyStripeSignature(payload, signature, secret) : false;
    if (!verified) return badRequest("Invalid Stripe signature");

    const event = stripeWebhookEventSchema.parse(JSON.parse(payload));
    const repos = await resolveRepositories();
    await processStripeWebhookEvent(repos, event);
    return ok({ received: true });
  });
}
