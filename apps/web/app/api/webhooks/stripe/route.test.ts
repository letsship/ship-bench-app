import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { POST } from "./route";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const SECRET = "whsec_test_secret";

async function sign(timestamp: number, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${payload}`),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signedRequest(
  body: string,
  timestamp = Math.floor(Date.now() / 1000),
): Promise<NextRequest> {
  const signature = await sign(timestamp, body);
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: { "Stripe-Signature": `t=${timestamp},v1=${signature}` },
  });
}

describe("POST /api/webhooks/stripe", () => {
  let repos: Repositories;
  let invoiceId: string;

  beforeAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    const studio = await repos.studios.getFirst();
    const invoices = await repos.invoices.listByStudio(studio?.id ?? "");
    invoiceId = invoices[0].id;
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("rejects a missing signature header with 400 and changes nothing", async () => {
    const before = await repos.invoices.getById(invoiceId);
    const body = JSON.stringify({
      id: "evt_missing_sig",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: invoiceId } } },
    });
    const res = await POST(
      new NextRequest("http://localhost/api/webhooks/stripe", { method: "POST", body }),
    );
    expect(res.status).toBe(400);
    expect(await repos.invoices.getById(invoiceId)).toEqual(before);
  });

  it("rejects an invalid signature with 400 and changes nothing", async () => {
    const before = await repos.invoices.getById(invoiceId);
    const body = JSON.stringify({
      id: "evt_bad_sig",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: invoiceId } } },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const res = await POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body,
        headers: { "Stripe-Signature": `t=${timestamp},v1=deadbeef` },
      }),
    );
    expect(res.status).toBe(400);
    expect(await repos.invoices.getById(invoiceId)).toEqual(before);
  });

  it("marks the invoice paid on a validly signed invoice.paid event", async () => {
    const body = JSON.stringify({
      id: "evt_paid_1",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: invoiceId } } },
    });
    const res = await POST(await signedRequest(body));
    expect(res.status).toBe(200);

    const invoice = await repos.invoices.getById(invoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).not.toBeNull();
  });

  it("is idempotent when the same signed event is replayed", async () => {
    const body = JSON.stringify({
      id: "evt_paid_2",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: invoiceId } } },
    });
    const first = await POST(await signedRequest(body));
    expect(first.status).toBe(200);
    const paidAtFirst = (await repos.invoices.getById(invoiceId))?.paidAt;

    const second = await POST(await signedRequest(body));
    expect(second.status).toBe(200);

    const invoice = await repos.invoices.getById(invoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(paidAtFirst);
  });

  it("acknowledges a valid signature naming an unknown invoice and changes nothing", async () => {
    const before = await repos.invoices.getById(invoiceId);
    const body = JSON.stringify({
      id: "evt_unknown_invoice",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "no-such-invoice" } } },
    });
    const res = await POST(await signedRequest(body));
    expect(res.status).toBe(200);
    expect(await repos.invoices.getById(invoiceId)).toEqual(before);
  });

  it("rejects with 400 (not a 500) when STRIPE_WEBHOOK_SECRET is unset on this deployment", async () => {
    // Regression test: a deployment that never provisioned
    // STRIPE_WEBHOOK_SECRET must still reject unverifiable requests with 400
    // — it must never crash with an uncaught 500, since that would be
    // indistinguishable from "this endpoint is broken" rather than "this
    // request could not be authenticated".
    const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    vi.resetModules();
    try {
      const { POST: postWithoutSecret } = await import("./route");
      const body = JSON.stringify({
        id: "evt_no_secret",
        type: "invoice.paid",
        data: { object: { metadata: { invoice_id: invoiceId } } },
      });
      const res = await postWithoutSecret(
        new NextRequest("http://localhost/api/webhooks/stripe", {
          method: "POST",
          body,
          headers: { "Stripe-Signature": "t=1,v1=deadbeef" },
        }),
      );
      expect(res.status).toBe(400);
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
      vi.resetModules();
    }
  });

  it("acknowledges a valid signature with an unrelated event type and changes nothing", async () => {
    const before = await repos.invoices.getById(invoiceId);
    const body = JSON.stringify({
      id: "evt_other_type",
      type: "invoice.created",
      data: { object: { metadata: { invoice_id: invoiceId } } },
    });
    const res = await POST(await signedRequest(body));
    expect(res.status).toBe(200);
    expect(await repos.invoices.getById(invoiceId)).toEqual(before);
  });
});
