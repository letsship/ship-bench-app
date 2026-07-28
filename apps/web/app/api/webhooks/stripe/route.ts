import { resolveRepositories } from "@/lib/db/repos";
import { stripeWebhookSecret } from "@/lib/env";
import { handle, ok } from "@/lib/http";
import { processStripeWebhook } from "@/lib/services/stripe-webhooks";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — receive a Stripe webhook and mark the matching
// invoice paid. The signature is the auth (no session/studio resolution). The
// raw body is read via request.text() and is NEVER JSON-parsed before the
// signature check — verification runs over the exact bytes Stripe signed.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const payload = await request.text();
    const signatureHeader = request.headers.get("stripe-signature");
    const repos = await resolveRepositories();
    const result = await processStripeWebhook(repos, {
      payload,
      signatureHeader,
      secret: stripeWebhookSecret(),
      nowMs: Date.now(),
    });
    return ok(result);
  });
}
