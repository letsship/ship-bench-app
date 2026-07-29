import { resolveRepositories } from "@/lib/db/repos";
import { badRequest, handle, ok } from "@/lib/http";
import { handleStripeEvent } from "@/lib/services/stripe-webhook";
import {
  type StripeEvent,
  verifyStripeSignature,
} from "@/lib/domain/stripe-webhook";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — receives a Stripe webhook. Verifies the
// `Stripe-Signature` header against STRIPE_WEBHOOK_SECRET (Web Crypto HMAC,
// Cloudflare-Workers-safe) before doing anything; a missing/invalid signature
// is a 400 and changes nothing. The raw body is required for signature
// verification, so it is read before JSON parsing. Idempotent: replays of a
// known Stripe event id are a no-op. Unauthenticated by design — callers prove
// identity with the signature, not a session cookie.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("Stripe-Signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error("STRIPE_WEBHOOK_SECRET is not set; rejecting Stripe webhook");
      return badRequest("Webhook secret not configured");
    }

    const verified = await verifyStripeSignature(rawBody, signatureHeader, secret);
    if (!verified) return badRequest("Invalid Stripe signature");

    const event = JSON.parse(rawBody) as StripeEvent;
    const repos = await resolveRepositories();
    const result = await handleStripeEvent(repos, event);
    return ok({ received: true, ...result });
  });
}
