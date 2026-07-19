import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const TEST_SECRET = "test-stripe-secret";

async function createValidSignature(
  payload: string,
  secret: string,
): Promise<{ t: string; signature: string }> {
  const t = Math.floor(Date.now() / 1000).toString();
  const signedContent = `${t}.${payload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const signature = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { t, signature };
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("rejects missing Stripe-Signature header with 400", async () => {
    const payload = JSON.stringify({ id: "evt_123", type: "invoice.paid", data: { object: {} } });
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects invalid signature with 400", async () => {
    const payload = JSON.stringify({ id: "evt_123", type: "invoice.paid", data: { object: {} } });
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": "t=1620000000,v1=invalidsignature" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("marks open invoice as paid on valid invoice.paid event", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    __setTestRepositories(repos);

    const openInvoice = seed.invoices.find((inv) => inv.status === "open");
    if (!openInvoice) throw new Error("No open invoice in seed");

    const payload = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: openInvoice.id },
        },
      },
    });

    const { t, signature } = await createValidSignature(payload, TEST_SECRET);
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": `t=${t},v1=${signature}` },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const updated = await repos.invoices.getById(openInvoice.id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).not.toBeNull();
  });

  it("handles duplicate events idempotently", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    __setTestRepositories(repos);

    const openInvoice = seed.invoices.find((inv) => inv.status === "open");
    if (!openInvoice) throw new Error("No open invoice in seed");

    const payload = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: openInvoice.id },
        },
      },
    });

    const { t, signature } = await createValidSignature(payload, TEST_SECRET);

    // First request
    const request1 = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": `t=${t},v1=${signature}` },
    });
    const response1 = await POST(request1);
    expect(response1.status).toBe(200);

    const afterFirst = await repos.invoices.getById(openInvoice.id);
    const paidAtAfterFirst = afterFirst?.paidAt;

    // Second request with same event
    const request2 = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": `t=${t},v1=${signature}` },
    });
    const response2 = await POST(request2);
    expect(response2.status).toBe(200);

    const afterSecond = await repos.invoices.getById(openInvoice.id);
    expect(afterSecond?.status).toBe("paid");
    expect(afterSecond?.paidAt).toBe(paidAtAfterFirst);
  });

  it("responds 200 for valid event naming unknown invoice", async () => {
    const payload = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: "unknown_id" },
        },
      },
    });

    const { t, signature } = await createValidSignature(payload, TEST_SECRET);
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": `t=${t},v1=${signature}` },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it("responds 200 for valid event of non-invoice.paid type", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    __setTestRepositories(repos);

    const openInvoice = seed.invoices.find((inv) => inv.status === "open");
    if (!openInvoice) throw new Error("No open invoice in seed");

    const payload = JSON.stringify({
      id: "evt_123",
      type: "customer.created",
      data: {
        object: {
          metadata: { invoice_id: openInvoice.id },
        },
      },
    });

    const { t, signature } = await createValidSignature(payload, TEST_SECRET);
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": `t=${t},v1=${signature}` },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const unchanged = await repos.invoices.getById(openInvoice.id);
    expect(unchanged?.status).toBe("open");
    expect(unchanged?.paidAt).toBeNull();
  });

  it("rejects malformed JSON with 400", async () => {
    const payload = "not json";
    const { t, signature } = await createValidSignature(payload, TEST_SECRET);
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": `t=${t},v1=${signature}` },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
