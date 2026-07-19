import { badRequest, handle, ok } from "@/lib/http";
import { resolveRepositories } from "@/lib/db/repos";
import {
  verifyStripeSignature,
  parseStripeEvent,
  type StripeEvent,
} from "@/lib/domain/stripe-webhook";
import { processStripeEvent } from "@/lib/services/stripe-webhooks";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const payload = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return badRequest("Missing Stripe-Signature header");
    }

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return badRequest("STRIPE_WEBHOOK_SECRET not configured");
    }

    const isValid = await verifyStripeSignature(payload, signature, secret);
    if (!isValid) {
      return badRequest("Invalid Stripe-Signature");
    }

    let event: StripeEvent | null;
    try {
      const parsed = JSON.parse(payload) as unknown;
      event = parseStripeEvent(parsed);
    } catch {
      return badRequest("Invalid JSON in request body");
    }

    if (!event) {
      return badRequest("Invalid Stripe event format");
    }

    const repos = await resolveRepositories();
    await processStripeEvent(repos, event);

    return ok({ received: true });
  });
}
