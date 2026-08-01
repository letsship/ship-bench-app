import { resolveRepositories } from "@/lib/db/repos";
import { badRequest, handle, ok } from "@/lib/http";
import { handleStripeEvent } from "@/lib/services/webhooks";
import { InvalidStripeWebhookError, verifyStripeWebhook } from "@/lib/webhooks/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const rawBody = await request.text();
    let event;
    try {
      event = verifyStripeWebhook(
        rawBody,
        request.headers.get("Stripe-Signature"),
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (error) {
      if (error instanceof InvalidStripeWebhookError) return badRequest(error.message);
      throw error;
    }

    const repos = await resolveRepositories();
    await handleStripeEvent(repos, event);
    return ok({ received: true });
  });
}
