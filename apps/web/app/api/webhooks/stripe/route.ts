import { handle, ok } from "@/lib/http";
import { resolveRepositories } from "@/lib/db/repos";
import { processStripeWebhook } from "@/lib/services/stripe-webhook";
import { stripeWebhookSecret } from "@/lib/env";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — receive and process Stripe webhooks.
// Verifies the Stripe-Signature header, validates the event, and marks invoices
// paid for invoice.paid events. No authentication required (Stripe can't present
// a session).
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    // Read the raw body (the signature is over raw bytes)
    const payload = await request.text();

    // Get the Stripe-Signature header and the webhook secret
    const header = request.headers.get("Stripe-Signature") ?? undefined;
    const secret = stripeWebhookSecret();

    // Resolve repositories (no session/studio context needed)
    const repos = await resolveRepositories();

    // Process the webhook
    await processStripeWebhook(repos, { payload, header, secret });

    // Acknowledge every verified event (or error on bad signature)
    return ok({ acknowledged: true });
  });
}
