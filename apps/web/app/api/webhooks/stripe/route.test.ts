import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type Repositories, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { signStripePayload } from "@/lib/domain/stripe-webhook";

const NOW = new Date("2026-07-01T12:00:00.000Z");
const SECRET = "whsec_route_test";

let repos: Repositories;

const signedRequest = (payload: string, secret = SECRET): NextRequest =>
  new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signStripePayload(secret, payload, Date.now() / 1000) },
    body: payload,
  });

const unsignedRequest = (payload: string): NextRequest =>
  new NextRequest("http://localhost/api/webhooks/stripe", { method: "POST", body: payload });

const openInvoiceId = async (): Promise<string> => {
  const studio = await repos.studios.getFirst();
  if (!studio) throw new Error("seed must include a studio");
  const invoice = (await repos.invoices.listByStudio(studio.id)).find(
    (candidate) => candidate.status === "open",
  );
  if (!invoice) throw new Error("seed must include an open invoice");
  return invoice.id;
};

const invoicePaidPayload = (invoiceId: string) =>
  JSON.stringify({
    id: "evt_1",
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  });

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("marks the named invoice paid on a signed invoice.paid event", async () => {
    const invoiceId = await openInvoiceId();
    const res = await POST(signedRequest(invoicePaidPayload(invoiceId)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    const invoice = await repos.invoices.getById(invoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBeTruthy();
  });

  it("responds 200 to a duplicate delivery and pays exactly once", async () => {
    const invoiceId = await openInvoiceId();
    const payload = invoicePaidPayload(invoiceId);
    expect((await POST(signedRequest(payload))).status).toBe(200);
    const paidAt = (await repos.invoices.getById(invoiceId))?.paidAt;
    expect((await POST(signedRequest(payload))).status).toBe(200);
    const invoice = await repos.invoices.getById(invoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(paidAt);
  });

  it("rejects a missing signature with 400 and changes nothing", async () => {
    const invoiceId = await openInvoiceId();
    const res = await POST(unsignedRequest(invoicePaidPayload(invoiceId)));
    expect(res.status).toBe(400);
    expect((await repos.invoices.getById(invoiceId))?.status).toBe("open");
  });

  it("rejects an invalid signature with 400 and changes nothing", async () => {
    const invoiceId = await openInvoiceId();
    const res = await POST(signedRequest(invoicePaidPayload(invoiceId), "whsec_wrong"));
    expect(res.status).toBe(400);
    expect((await repos.invoices.getById(invoiceId))?.status).toBe("open");
  });

  it("acknowledges an unknown invoice with 200 and changes nothing", async () => {
    const res = await POST(signedRequest(invoicePaidPayload("inv_does_not_exist")));
    expect(res.status).toBe(200);
  });

  it("acknowledges other event types with 200 and changes nothing", async () => {
    const invoiceId = await openInvoiceId();
    const payload = JSON.stringify({
      id: "evt_2",
      type: "customer.created",
      data: { object: { metadata: { invoice_id: invoiceId } } },
    });
    expect((await POST(signedRequest(payload))).status).toBe(200);
    expect((await repos.invoices.getById(invoiceId))?.status).toBe("open");
  });
});
