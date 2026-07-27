import type { NextRequest } from "next/server";
import { handle, ok, HttpError } from "@/lib/http";
import { parseStripeEvent, verifyStripeSignature } from "@/lib/domain/stripe-webhook";
import { handleStripeEvent } from "@/lib/services/stripe-webhooks";
import { resolveRepositories } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const rawBody = await request.text();
    const header = request.headers.get("Stripe-Signature") ?? undefined;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    const isValid = await verifyStripeSignature(rawBody, header, secret);
    if (!isValid) {
      throw new HttpError(400, "invalid_signature", "Invalid or missing Stripe signature");
    }

    const event = parseStripeEvent(rawBody);
    const repos = await resolveRepositories();
    await handleStripeEvent(repos, event);

    return ok({ received: true });
  });
}
