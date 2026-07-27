import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { computeStripeSignature } from "@/lib/domain/stripe-webhook";
import { POST } from "./route";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const SECRET = "whsec_route_test_secret";
const TIMESTAMP = "1774526400";

let repos: Repositories;
let openInvoiceId: string;

async function post(payload: string, header?: string): Promise<Response> {
  return POST(
    new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: header ? { "stripe-signature": header } : {},
      body: payload,
    }),
  );
}

async function postSigned(payload: string, secret = SECRET): Promise<Response> {
  const signature = await computeStripeSignature({ payload, timestamp: TIMESTAMP, secret });
  return post(payload, `t=${TIMESTAMP},v1=${signature}`);
}

const invoicePaidPayload = (eventId: string, invoiceId: string): string =>
  JSON.stringify({
    id: eventId,
    type: "invoice.paid",
    data: { object: { id: "in_stripe", metadata: { invoice_id: invoiceId } } },
  });

describe("POST /api/webhooks/stripe", () => {
  beforeEach(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    const studio = await repos.studios.getFirst();
    const invoices = await repos.invoices.listByStudio(studio?.id ?? "");
    openInvoiceId = invoices.find((invoice) => invoice.status === "open")?.id ?? "";
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    __setTestRepositories(null);
  });

  it("marks the invoice paid on a verified invoice.paid event", async () => {
    const res = await postSigned(invoicePaidPayload("evt_1", openInvoiceId));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBeTruthy();
  });

  it("rejects a missing signature with 400 and changes nothing", async () => {
    const res = await post(invoicePaidPayload("evt_1", openInvoiceId));

    expect(res.status).toBe(400);
    expect((await repos.invoices.getById(openInvoiceId))?.status).toBe("open");
  });

  it("rejects a signature made with the wrong secret with 400 and changes nothing", async () => {
    const res = await postSigned(invoicePaidPayload("evt_1", openInvoiceId), "whsec_wrong");

    expect(res.status).toBe(400);
    expect((await repos.invoices.getById(openInvoiceId))?.status).toBe("open");
  });

  it("rejects a signature that does not match the body with 400", async () => {
    const payload = invoicePaidPayload("evt_1", openInvoiceId);
    const signature = await computeStripeSignature({
      payload,
      timestamp: TIMESTAMP,
      secret: SECRET,
    });
    const res = await post(
      invoicePaidPayload("evt_1", "inv_tampered"),
      `t=${TIMESTAMP},v1=${signature}`,
    );

    expect(res.status).toBe(400);
    expect((await repos.invoices.getById(openInvoiceId))?.status).toBe("open");
  });

  it("responds 200 to a redelivered event and pays the invoice exactly once", async () => {
    const payload = invoicePaidPayload("evt_dup", openInvoiceId);

    const first = await postSigned(payload);
    const paidAt = (await repos.invoices.getById(openInvoiceId))?.paidAt;
    const second = await postSigned(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(paidAt);
  });

  it("acknowledges an unknown invoice and other event types with 200", async () => {
    const unknown = await postSigned(invoicePaidPayload("evt_unknown", "inv_missing"));
    const otherType = await postSigned(
      JSON.stringify({
        id: "evt_other",
        type: "payment_intent.succeeded",
        data: { object: { metadata: { invoice_id: openInvoiceId } } },
      }),
    );

    expect(unknown.status).toBe(200);
    expect(otherType.status).toBe(200);
    expect((await repos.invoices.getById(openInvoiceId))?.status).toBe("open");
  });
});
