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

async function computeStripeSignature(
  timestamp: string,
  body: string,
  secret: string,
): Promise<string> {
  const signedContent = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("POST /api/webhooks/stripe", () => {
  const testSecret = "whsec_test_secret";
  let testRepos: ReturnType<typeof createInMemoryRepositories>;
  let studioId: string;

  beforeEach(() => {
    const seed = buildSeed(NOW);
    testRepos = createInMemoryRepositories(seed);
    __setTestRepositories(testRepos);
    studioId = seed.studio.id;
    process.env.STRIPE_WEBHOOK_SECRET = testSecret;
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("rejects a request with missing Stripe-Signature header (400)", async () => {
    const invoices = await testRepos.invoices.listByStudio(studioId);
    const targetInvoice = invoices.find((inv) => inv.status === "open");
    if (!targetInvoice) throw new Error("No open invoice in seed");

    const body = JSON.stringify({
      id: "evt_test",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: targetInvoice.id,
          },
        },
      },
    });

    const req = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
    });

    const res = await stripeWebhookPost(req);
    expect(res.status).toBe(400);

    const updated = await testRepos.invoices.getById(targetInvoice.id);
    expect(updated?.status).toBe("open");
    expect(updated?.paidAt).toBeNull();
  });

  it("rejects a request with invalid signature (400)", async () => {
    const invoices = await testRepos.invoices.listByStudio(studioId);
    const targetInvoice = invoices.find((inv) => inv.status === "open");
    if (!targetInvoice) throw new Error("No open invoice in seed");

    const body = JSON.stringify({
      id: "evt_test",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: targetInvoice.id,
          },
        },
      },
    });

    const req = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
      headers: {
        "stripe-signature": "t=1234567890,v1=invalidsignature123456789012345678",
      },
    });

    const res = await stripeWebhookPost(req);
    expect(res.status).toBe(400);

    const updated = await testRepos.invoices.getById(targetInvoice.id);
    expect(updated?.status).toBe("open");
    expect(updated?.paidAt).toBeNull();
  });

  it("marks an invoice as paid on valid invoice.paid event (200)", async () => {
    const invoices = await testRepos.invoices.listByStudio(studioId);
    const targetInvoice = invoices.find((inv) => inv.status === "open");
    if (!targetInvoice) throw new Error("No open invoice in seed");

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      id: "evt_test_paid",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: targetInvoice.id,
          },
        },
      },
    });

    const sig = await computeStripeSignature(timestamp, body, testSecret);
    const req = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
      headers: {
        "stripe-signature": `t=${timestamp},v1=${sig}`,
      },
    });

    const res = await stripeWebhookPost(req);
    expect(res.status).toBe(200);

    const updated = await testRepos.invoices.getById(targetInvoice.id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).not.toBeNull();
  });

  it("handles idempotent replays (200, no double-process)", async () => {
    const invoices = await testRepos.invoices.listByStudio(studioId);
    const targetInvoice = invoices.find((inv) => inv.status === "open");
    if (!targetInvoice) throw new Error("No open invoice in seed");

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      id: "evt_test_idempotent",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: targetInvoice.id,
          },
        },
      },
    });

    const sig = await computeStripeSignature(timestamp, body, testSecret);
    const req = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
      headers: {
        "stripe-signature": `t=${timestamp},v1=${sig}`,
      },
    });

    const firstRes = await stripeWebhookPost(req);
    expect(firstRes.status).toBe(200);

    const afterFirst = await testRepos.invoices.getById(targetInvoice.id);
    expect(afterFirst?.status).toBe("paid");
    const paidAtAfterFirst = afterFirst?.paidAt;

    const secondReq = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
      headers: {
        "stripe-signature": `t=${timestamp},v1=${sig}`,
      },
    });

    const secondRes = await stripeWebhookPost(secondReq);
    expect(secondRes.status).toBe(200);

    const afterSecond = await testRepos.invoices.getById(targetInvoice.id);
    expect(afterSecond?.status).toBe("paid");
    expect(afterSecond?.paidAt).toBe(paidAtAfterFirst);
  });

  it("acknowledges unknown invoice (200, no change)", async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      id: "evt_test_unknown",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: "nonexistent-invoice-id",
          },
        },
      },
    });

    const sig = await computeStripeSignature(timestamp, body, testSecret);
    const req = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
      headers: {
        "stripe-signature": `t=${timestamp},v1=${sig}`,
      },
    });

    const res = await stripeWebhookPost(req);
    expect(res.status).toBe(200);
  });

  it("acknowledges non-invoice.paid events (200, no change)", async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      id: "evt_test_other_type",
      type: "charge.succeeded",
      data: {
        object: {},
      },
    });

    const sig = await computeStripeSignature(timestamp, body, testSecret);
    const req = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
      headers: {
        "stripe-signature": `t=${timestamp},v1=${sig}`,
      },
    });

    const res = await stripeWebhookPost(req);
    expect(res.status).toBe(200);
  });
});
