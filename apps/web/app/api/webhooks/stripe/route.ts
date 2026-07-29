import { handle, ok, badRequest } from "@/lib/http";
import { resolveRepositories } from "@/lib/db/repos";
import { constructStripeEvent } from "@/lib/stripe/webhook";
import { stripeEventSchema } from "@/lib/validation";
import { handleStripeEvent } from "@/lib/services/stripe-webhooks";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const payload = await request.text();
    const signature = request.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      console.error("STRIPE_WEBHOOK_SECRET is not configured");
      return badRequest("Webhook not configured");
    }

    let event: unknown;
    try {
      event = constructStripeEvent(payload, signature, secret);
    } catch {
      return badRequest("Invalid signature");
    }

    const parsed = stripeEventSchema.parse(event);
    const repos = await resolveRepositories();
    await handleStripeEvent(repos, parsed);
    return ok({ received: true });
  });
}