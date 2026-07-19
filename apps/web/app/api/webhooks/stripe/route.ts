import type { NextRequest } from "next/server";
import { HttpError, handle, ok } from "@/lib/http";
import { constructStripeEvent, StripeSignatureError } from "@/lib/stripe/webhook";
import { markInvoicePaidFromWebhook } from "@/lib/services/invoices";
import { resolveRepositories } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  return handle(async () => {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("Stripe-Signature") ?? undefined;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    try {
      const event = constructStripeEvent(rawBody, signatureHeader, secret);

      if (event.type === "invoice.paid") {
        const repos = await resolveRepositories();
        const invoiceId = event.data?.object?.metadata?.invoice_id;
        await markInvoicePaidFromWebhook(repos, invoiceId);
      }

      return ok({ received: true });
    } catch (error) {
      if (error instanceof StripeSignatureError) {
        throw new HttpError(400, "invalid_signature", error.message);
      }
      throw error;
    }
  });
}
