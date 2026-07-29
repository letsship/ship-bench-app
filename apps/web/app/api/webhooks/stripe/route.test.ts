import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import {
  buildStripeSignatureHeader,
  signStripePayload,
} from "@/lib/webhooks/stripe-signature";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const SECRET = "whsec_test_secret";
const TIMESTAMP = "1700000000";

const OPEN_INVOICE_ID = "inv_open";
const UNKNOWN_INVOICE_ID = "inv_does_not_exist";

function invoicePayload(invoiceId: string, eventId: string, type = "invoice.paid"): string {
  return JSON.stringify({
    id: eventId,
    type,
    data: { object: { metadata: { invoice_id: invoiceId } } },
  });
}

async function signedHeaders(body: string, secret: string = SECRET): Promise<Headers> {
  const sig = await signStripePayload(secret, TIMESTAMP, body);
  const headers = new Headers();
  headers.set("Stripe-Signature", buildStripeSignatureHeader(TIMESTAMP, sig));
  headers.set("content-type", "application/json");
  return headers;
}

function request(body: string, headers: Headers): Request {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_test";
    process.env.SUPABASE_SECRET_KEY = "sk_test";
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });

  beforeEach(() => {
    const seed = buildSeed(NOW);
    // Seed an open invoice we can flip to paid. Keep the demo seed's studio so
    // resolveRepositories works; just append a known open invoice.
    seed.invoices = [
      ...seed.invoices,
      {
        id: OPEN_INVOICE_ID,
        studioId: seed.studio.id,
        memberId: seed.members[0].id,
        number: "INV-TEST-0001",
        status: "open",
        currency: "EUR",
        taxRateBps: 900,
        subtotalCents: 1000,
        taxCents: 90,
        totalCents: 1090,
        issuedAt: NOW.toISOString(),
        dueAt: null,
        paidAt: null,
        createdAt: NOW.toISOString(),
      },
    ];
    __setTestRepositories(createInMemoryRepositories(seed));
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("rejects a missing signature with 400 and leaves the invoice unchanged", async () => {
    const body = invoicePayload(OPEN_INVOICE_ID, "evt_1");
    const headers = new Headers({ "content-type": "application/json" });
    const res = await POST(request(body, headers));
    expect(res.status).toBe(400);
    const invoice = await (await __repos()).invoices.getById(OPEN_INVOICE_ID);
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });

  it("rejects an invalid signature with 400 and changes nothing", async () => {
    const body = invoicePayload(OPEN_INVOICE_ID, "evt_2");
    const headers = await signedHeaders(body, "whsec_wrong_secret");
    const res = await POST(request(body, headers));
    expect(res.status).toBe(400);
    const invoice = await (await __repos()).invoices.getById(OPEN_INVOICE_ID);
    expect(invoice?.status).toBe("open");
  });

  it("marks the named invoice paid on a verified invoice.paid event (200)", async () => {
    const body = invoicePayload(OPEN_INVOICE_ID, "evt_paid");
    const res = await POST(request(body, await signedHeaders(body)));
    expect(res.status).toBe(200);
    const invoice = await (await __repos()).invoices.getById(OPEN_INVOICE_ID);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).not.toBeNull();
  });

  it("is idempotent: a duplicate event id leaves the invoice paid once (200)", async () => {
    const body = invoicePayload(OPEN_INVOICE_ID, "evt_dup");
    const headers = await signedHeaders(body);
    const first = await POST(request(body, headers));
    expect(first.status).toBe(200);
    const afterFirst = await (await __repos()).invoices.getById(OPEN_INVOICE_ID);
    const firstPaidAt = afterFirst?.paidAt;

    const second = await POST(request(body, headers));
    expect(second.status).toBe(200);
    const afterSecond = await (await __repos()).invoices.getById(OPEN_INVOICE_ID);
    expect(afterSecond?.status).toBe("paid");
    expect(afterSecond?.paidAt).toBe(firstPaidAt);
  });

  it("acknowledges an unknown invoice id with 200 and changes nothing", async () => {
    const body = invoicePayload(UNKNOWN_INVOICE_ID, "evt_unknown");
    const res = await POST(request(body, await signedHeaders(body)));
    expect(res.status).toBe(200);
    const invoice = await (await __repos()).invoices.getById(UNKNOWN_INVOICE_ID);
    expect(invoice).toBeNull();
  });

  it("acknowledges an unrelated event type with 200 and changes nothing", async () => {
    const body = invoicePayload(OPEN_INVOICE_ID, "evt_other", "charge.refunded");
    const res = await POST(request(body, await signedHeaders(body)));
    expect(res.status).toBe(200);
    const invoice = await (await __repos()).invoices.getById(OPEN_INVOICE_ID);
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });
});

// Resolve the currently-injected test repositories (testRepositories is set by
// __setTestRepositories, so resolveRepositories returns it without touching env).
async function __repos() {
  const { resolveRepositories } = await import("@/lib/db/repos");
  return resolveRepositories();
}
