import { resolveRepositories } from "@/lib/db/repos";
import { serverEnv } from "@/lib/env";
import { badRequest, handle, ok } from "@/lib/http";
import { verifyStripeSignature } from "@/lib/payments/stripe";
import { markInvoicePaidFromWebhook } from "@/lib/services/invoices";
import { stripeWebhookEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function safeJsonParse(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

// POST /api/webhooks/stripe — receives Stripe payment webhooks and marks the
// matching invoice paid on a verified `invoice.paid` event. Always reads the
// raw body text (never `request.json()` first) since signature verification
// needs the exact bytes Stripe signed.
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const payload = await request.text();
    const signature = request.headers.get("Stripe-Signature");
    const verified = await verifyStripeSignature(
      payload,
      signature,
      serverEnv().STRIPE_WEBHOOK_SECRET,
      Date.now(),
    );
    if (!verified) return badRequest("Invalid or missing Stripe-Signature");

    const parsed = stripeWebhookEventSchema.safeParse(safeJsonParse(payload));
    const invoiceId = parsed.success ? parsed.data.data.object.metadata?.invoice_id : undefined;
    if (!parsed.success || parsed.data.type !== "invoice.paid" || !invoiceId) {
      return ok({ received: true });
    }

    const repos = await resolveRepositories();
    await markInvoicePaidFromWebhook(repos, invoiceId);
    return ok({ received: true });
  });
}
