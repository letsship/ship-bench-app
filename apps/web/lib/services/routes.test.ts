import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as stripeWebhookPost } from "@/app/api/webhooks/stripe/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/classes returns sessions with occupancy", async () => {
    const res = await classesGet(new NextRequest("http://localhost/api/classes"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty("occupancy");
  });

  it("GET /api/classes honours a from filter", async () => {
    const res = await classesGet(
      new NextRequest("http://localhost/api/classes?from=2099-01-01T00:00:00.000Z"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("GET /api/invoices returns invoices with a number", async () => {
    const res = await invoicesGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body[0]).toHaveProperty("number");
  });

  it("GET /api/members returns the studio's members", async () => {
    const res = await membersGet();
    expect(res.status).toBe(200);
    expect(((await res.json()) as unknown[]).length).toBeGreaterThan(0);
  });
});

const encoder = new TextEncoder();

async function signStripeBody(body: string, secret: string, nowMs: number): Promise<string> {
  const t = Math.floor(nowMs / 1000);
  const signedContent = `${t}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  let hex = "";
  for (const byte of new Uint8Array(signature)) hex += byte.toString(16).padStart(2, "0");
  return `t=${t},v1=${hex}`;
}

describe("POST /api/webhooks/stripe (against injected fake repositories)", () => {
  const testSecret = "test-webhook-secret";
  let testRepos: ReturnType<typeof createInMemoryRepositories>;

  beforeEach(() => {
    testRepos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(testRepos);
    process.env.STRIPE_WEBHOOK_SECRET = testSecret;
  });
  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("returns 400 when Stripe-Signature header is missing", async () => {
    const body = '{"id":"evt_1","type":"invoice.paid","data":{"object":{"metadata":{}}}}';
    const req = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
    });
    const res = await stripeWebhookPost(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature is invalid", async () => {
    const body = '{"id":"evt_1","type":"invoice.paid","data":{"object":{"metadata":{}}}}';
    const req = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
      headers: { "stripe-signature": "t=1234567890,v1=invalidsignature" },
    });
    const res = await stripeWebhookPost(req);
    expect(res.status).toBe(400);
  });

  it("marks an open invoice paid on valid invoice.paid event", async () => {
    const { newId } = await import("@/lib/db/ids");
    const invoiceId = newId();
    const invoice = await testRepos.invoices.insert({
      id: invoiceId,
      studioId: "studio-1",
      memberId: "member-1",
      number: "INV-2026-0001",
      status: "open",
      currency: "EUR",
      taxRateBps: 2100,
      subtotalCents: 10000,
      taxCents: 2100,
      totalCents: 12100,
      issuedAt: new Date().toISOString(),
      dueAt: null,
      paidAt: null,
      createdAt: new Date().toISOString(),
    });

    const body = JSON.stringify({
      id: "evt_1",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: invoice.id } } },
    });

    const signature = await signStripeBody(body, testSecret, Date.now());
    const req = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
      headers: { "stripe-signature": signature },
    });
    const res = await stripeWebhookPost(req);
    expect(res.status).toBe(200);

    const updated = await testRepos.invoices.getById(invoice.id);
    if (!updated) throw new Error("Invoice not found");
    expect(updated.status).toBe("paid");
    expect(updated.paidAt).not.toBeNull();
  });

  it("leaves an already-paid invoice unchanged on duplicate event", async () => {
    const { newId } = await import("@/lib/db/ids");
    const invoiceId = newId();
    const invoice = await testRepos.invoices.insert({
      id: invoiceId,
      studioId: "studio-1",
      memberId: "member-1",
      number: "INV-2026-0002",
      status: "open",
      currency: "EUR",
      taxRateBps: 2100,
      subtotalCents: 10000,
      taxCents: 2100,
      totalCents: 12100,
      issuedAt: new Date().toISOString(),
      dueAt: null,
      paidAt: null,
      createdAt: new Date().toISOString(),
    });

    const body = JSON.stringify({
      id: "evt_1",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: invoice.id } } },
    });

    const signature = await signStripeBody(body, testSecret, Date.now());

    const req1 = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
      headers: { "stripe-signature": signature },
    });
    const res1 = await stripeWebhookPost(req1);
    expect(res1.status).toBe(200);

    const afterFirst = await testRepos.invoices.getById(invoice.id);
    if (!afterFirst) throw new Error("Invoice not found");
    const paidAtFirst = afterFirst.paidAt;

    const req2 = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
      headers: { "stripe-signature": signature },
    });
    const res2 = await stripeWebhookPost(req2);
    expect(res2.status).toBe(200);

    const afterSecond = await testRepos.invoices.getById(invoice.id);
    if (!afterSecond) throw new Error("Invoice not found");
    expect(afterSecond.status).toBe("paid");
    expect(afterSecond.paidAt).toBe(paidAtFirst);
  });

  it("returns 200 and changes nothing for an unknown invoice", async () => {
    const body = JSON.stringify({
      id: "evt_1",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "unknown-id" } } },
    });

    const signature = await signStripeBody(body, testSecret, Date.now());
    const req = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
      headers: { "stripe-signature": signature },
    });
    const res = await stripeWebhookPost(req);
    expect(res.status).toBe(200);
  });

  it("returns 200 and changes nothing for a non-invoice.paid event", async () => {
    const { newId } = await import("@/lib/db/ids");
    const invoiceId = newId();
    const invoice = await testRepos.invoices.insert({
      id: invoiceId,
      studioId: "studio-1",
      memberId: "member-1",
      number: "INV-2026-0003",
      status: "open",
      currency: "EUR",
      taxRateBps: 2100,
      subtotalCents: 10000,
      taxCents: 2100,
      totalCents: 12100,
      issuedAt: new Date().toISOString(),
      dueAt: null,
      paidAt: null,
      createdAt: new Date().toISOString(),
    });

    const body = JSON.stringify({
      id: "evt_1",
      type: "customer.created",
      data: { object: { metadata: { invoice_id: invoice.id } } },
    });

    const signature = await signStripeBody(body, testSecret, Date.now());
    const req = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
      headers: { "stripe-signature": signature },
    });
    const res = await stripeWebhookPost(req);
    expect(res.status).toBe(200);

    const unchanged = await testRepos.invoices.getById(invoice.id);
    if (!unchanged) throw new Error("Invoice not found");
    expect(unchanged.status).toBe("open");
  });
});
