import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const TEST_SECRET = "whsec_test_secret_123";

async function computeSignature(
  payload: string,
  timestamp: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const signedContent = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  let hex = "";
  for (const byte of new Uint8Array(digest)) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

describe("POST /api/webhooks/stripe", () => {
  let openInvoiceId: string;
  let testRepos: Repositories;

  beforeEach(() => {
    const seed = buildSeed(NOW);
    const openInvoice = seed.invoices.find((inv) => inv.status === "open");
    if (!openInvoice) throw new Error("No open invoice in seed");
    openInvoiceId = openInvoice.id;
    testRepos = createInMemoryRepositories(seed);
    __setTestRepositories(testRepos);
    process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("rejects missing signature with 400", async () => {
    const payload =
      '{"id":"evt_123","type":"invoice.paid","data":{"object":{"metadata":{"invoice_id":"inv_456"}}}}';
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
    const body = (await res.json()) as unknown;
    expect(body).toHaveProperty("error.code", "invalid_signature");
  });

  it("rejects invalid signature with 400", async () => {
    const payload =
      '{"id":"evt_123","type":"invoice.paid","data":{"object":{"metadata":{"invoice_id":"inv_456"}}}}';
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "Stripe-Signature": "t=1234567890,v1=badsignature",
      },
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
  });

  it("marks invoice paid on valid invoice.paid event with 200", async () => {
    const timestamp = "1234567890";
    const payload = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: openInvoiceId },
        },
      },
    });
    const signature = await computeSignature(payload, timestamp, TEST_SECRET);
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "Stripe-Signature": `t=${timestamp},v1=${signature}`,
      },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);

    // Verify invoice was marked paid
    const invoice = await testRepos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBeDefined();
  });

  it("is idempotent: replaying same event leaves invoice paid once with 200", async () => {
    const timestamp = "1234567890";
    const payload = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: openInvoiceId },
        },
      },
    });
    const signature = await computeSignature(payload, timestamp, TEST_SECRET);

    // First request
    const request1 = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "Stripe-Signature": `t=${timestamp},v1=${signature}`,
      },
    });
    const res1 = await POST(request1);
    expect(res1.status).toBe(200);

    const afterFirst = await testRepos.invoices.getById(openInvoiceId);
    const paidAtAfterFirst = afterFirst?.paidAt;

    // Second request (replay)
    const request2 = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "Stripe-Signature": `t=${timestamp},v1=${signature}`,
      },
    });
    const res2 = await POST(request2);
    expect(res2.status).toBe(200);

    const afterSecond = await testRepos.invoices.getById(openInvoiceId);
    expect(afterSecond?.status).toBe("paid");
    expect(afterSecond?.paidAt).toBe(paidAtAfterFirst);
  });

  it("acknowledges unknown invoice id with 200 and changes nothing", async () => {
    const timestamp = "1234567890";
    const payload = JSON.stringify({
      id: "evt_456",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: "unknown_invoice_id" },
        },
      },
    });
    const signature = await computeSignature(payload, timestamp, TEST_SECRET);
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "Stripe-Signature": `t=${timestamp},v1=${signature}`,
      },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);

    const invoice = await testRepos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });

  it("acknowledges non-invoice.paid event with 200 and changes nothing", async () => {
    const timestamp = "1234567890";
    const payload = JSON.stringify({
      id: "evt_789",
      type: "charge.succeeded",
      data: {
        object: {
          metadata: { invoice_id: openInvoiceId },
        },
      },
    });
    const signature = await computeSignature(payload, timestamp, TEST_SECRET);
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "Stripe-Signature": `t=${timestamp},v1=${signature}`,
      },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);

    const invoice = await testRepos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });
});
