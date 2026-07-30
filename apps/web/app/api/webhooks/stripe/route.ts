import { resolveRepositories } from "@/lib/db/repos";
import { verifyStripeSignature } from "@/lib/domain/stripe-webhook";
import { badRequest, handle, ok } from "@/lib/http";
import { processStripeEvent } from "@/lib/services/stripe-webhooks";
import { stripeEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — receive a Stripe webhook, verify the signature
// against STRIPE_WEBHOOK_SECRET, and mark the named invoice paid on a verified
// `invoice.paid` event. The secret is read from process.env directly (not via
// serverEnv()) so hermetic tests need no Supabase vars. The RAW body is read
// with `request.text()` because Stripe signs the exact request bytes —
// re-serialized JSON would not match. All async work is awaited (Cloudflare
// Workers rule) and wrapped in handle() for the shared error envelope.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = request.headers.get("stripe-signature");
    const payload = await request.text();

    if (!secret || !signature || !(await verifyStripeSignature(payload, signature, secret))) {
      return badRequest("Invalid Stripe signature");
    }

    const event = stripeEventSchema.parse(JSON.parse(payload));
    const repos = await resolveRepositories();
    const outcome = await processStripeEvent(repos, event);
    return ok({ received: true, outcome });
  });
}
