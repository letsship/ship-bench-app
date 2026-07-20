import { badRequest, handle, ok } from "@/lib/http";
import { resolveRepositories } from "@/lib/db/repos";
import { serverEnv } from "@/lib/env";
import { constructStripeEvent } from "@/lib/stripe/verify";
import { stripeEventSchema } from "@/lib/validation";
import { processStripeEvent } from "@/lib/services/webhooks";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — receive and process Stripe webhooks.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    // Read the raw body (required for signature verification)
    const rawBody = await request.text();
    const header = request.headers.get("Stripe-Signature");

    // Verify the signature
    const env = serverEnv();
    if (!env.STRIPE_WEBHOOK_SECRET) {
      return badRequest("Stripe webhook secret not configured");
    }

    const event = await constructStripeEvent(rawBody, header, env.STRIPE_WEBHOOK_SECRET);

    // If signature is invalid, reject with 400
    if (!event) {
      return badRequest("Invalid or missing Stripe signature");
    }

    // Parse and validate the event
    const validated = stripeEventSchema.parse(event);

    // Resolve repositories (no session required for webhooks)
    const repos = await resolveRepositories();

    // Process the event
    await processStripeEvent(repos, validated);

    // Return 200 for every verified outcome (acknowledged)
    return ok({ received: true });
  });
}
