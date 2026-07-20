import { resolveRepositories } from "@/lib/db/repos";
import { handle, ok } from "@/lib/http";
import { handleStripeEvent } from "@/lib/services/stripe-webhooks";
import { verifyStripeWebhook } from "@/lib/domain/stripe-webhook";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

    const event = await verifyStripeWebhook(rawBody, signatureHeader, secret);

    const repos = await resolveRepositories();
    await handleStripeEvent(repos, event);

    return ok({ received: true });
  });
}
