import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { POST } from "./route";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const SECRET = "whsec_route_test_secret";

// Build a genuine Stripe-Signature header in-test: the same HMAC-SHA256 over
// `${t}.${rawBody}` that Stripe computes, so no network or stripe pkg is needed.
function sign(rawBody: string, secret: string = SECRET): string {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex");
  return `t=${t},v1=${v1}`;
}

function stripeRequest(rawBody: string, signature?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature) headers.set("stripe-signature", signature);
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

function invoicePaidPayload(invoiceId: string, eventId = "evt_1"): string {
  return JSON.stringify({
    id: eventId,
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  });
}

describe("POST /api/webhooks/stripe", () => {
  let repos: Repositories;
  let openInvoiceId: string;

  beforeEach(() => {
    const seed = buildSeed(NOW);
    const open = seed.invoices.find((invoice) => invoice.status === "open");
    if (!open) throw new Error("seed must contain an open invoice");
    openInvoiceId = open.id;
    repos = createInMemoryRepositories(seed);
    __setTestRepositories(repos);
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("rejects a request with no Stripe-Signature header and changes nothing", async () => {
    const res = await POST(stripeRequest(invoicePaidPayload(openInvoiceId)));
    expect(res.status).toBe(400);
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });

  it("rejects a request with an invalid signature and changes nothing", async () => {
    const rawBody = invoicePaidPayload(openInvoiceId);
    const res = await POST(stripeRequest(rawBody, sign(rawBody, "whsec_wrong_secret")));
    expect(res.status).toBe(400);
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });

  it("marks the named invoice paid on a verified invoice.paid event", async () => {
    const rawBody = invoicePaidPayload(openInvoiceId);
    const res = await POST(stripeRequest(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).not.toBeNull();
  });

  it("processes a replay of the same event exactly once", async () => {
    const rawBody = invoicePaidPayload(openInvoiceId, "evt_replay");
    const signature = sign(rawBody);

    const first = await POST(stripeRequest(rawBody, signature));
    expect(first.status).toBe(200);
    const afterFirst = await repos.invoices.getById(openInvoiceId);
    expect(afterFirst?.status).toBe("paid");

    const replay = await POST(stripeRequest(rawBody, signature));
    expect(replay.status).toBe(200);
    const afterReplay = await repos.invoices.getById(openInvoiceId);
    expect(afterReplay?.status).toBe("paid");
    expect(afterReplay?.paidAt).toBe(afterFirst?.paidAt);
  });

  it("acknowledges a verified event naming an unknown invoice and changes nothing", async () => {
    const rawBody = invoicePaidPayload("inv_unknown");
    const res = await POST(stripeRequest(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });

  it("acknowledges a verified event of any other type and changes nothing", async () => {
    const rawBody = JSON.stringify({
      id: "evt_other",
      type: "customer.created",
      data: { object: { metadata: { invoice_id: openInvoiceId } } },
    });
    const res = await POST(stripeRequest(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });
});
