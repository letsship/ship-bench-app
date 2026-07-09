import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";

const SECRET = "whsec_test_secret";
const NOW = new Date("2026-03-15T12:00:00.000Z");
const ISO = NOW.toISOString();
const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signedHeader(secret: string, rawBody: string): Promise<string> {
  const timestamp = "1700000000";
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${rawBody}`),
  );
  return `t=${timestamp},v1=${toHex(new Uint8Array(signature))}`;
}

function seed(): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: 900,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [
      {
        id: "inv1",
        studioId: "s1",
        memberId: "m1",
        number: "INV-2026-0001",
        status: "open",
        currency: "EUR",
        taxRateBps: 900,
        subtotalCents: 1000,
        taxCents: 90,
        totalCents: 1090,
        issuedAt: ISO,
        dueAt: null,
        paidAt: null,
        createdAt: ISO,
      },
    ],
    lineItems: [],
    outbox: [],
    webhookEvents: [],
  };
}

function invoicePaidBody(eventId: string, invoiceId: string): string {
  return JSON.stringify({
    id: eventId,
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  });
}

function postRequest(body: string, signature: string | null): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature) headers["Stripe-Signature"] = signature;
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers,
  });
}

describe("POST /api/webhooks/stripe", () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let repos: ReturnType<typeof createInMemoryRepositories>;

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    repos = createInMemoryRepositories(seed());
    __setTestRepositories(repos);
  });

  afterEach(() => {
    __setTestRepositories(null);
    process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  });

  it("rejects a request with a missing signature (400, invoice unchanged)", async () => {
    const body = invoicePaidBody("evt1", "inv1");
    const res = await POST(postRequest(body, null));
    expect(res.status).toBe(400);
    expect((await repos.invoices.getById("inv1"))?.status).toBe("open");
  });

  it("rejects a request with an invalid/tampered signature (400, invoice unchanged)", async () => {
    const body = invoicePaidBody("evt1", "inv1");
    const badSignature = await signedHeader(SECRET, invoicePaidBody("evt1", "some-other-invoice"));
    const res = await POST(postRequest(body, badSignature));
    expect(res.status).toBe(400);
    expect((await repos.invoices.getById("inv1"))?.status).toBe("open");
  });

  it("marks a known invoice paid on a verified invoice.paid event (200)", async () => {
    const body = invoicePaidBody("evt1", "inv1");
    const signature = await signedHeader(SECRET, body);
    const res = await POST(postRequest(body, signature));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });

    const invoice = await repos.invoices.getById("inv1");
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).not.toBeNull();
  });

  it("is idempotent: replaying the identical event leaves the invoice paid exactly once (200)", async () => {
    const body = invoicePaidBody("evt1", "inv1");
    const signature = await signedHeader(SECRET, body);

    const first = await POST(postRequest(body, signature));
    expect(first.status).toBe(200);
    const paidAtAfterFirst = (await repos.invoices.getById("inv1"))?.paidAt;

    const second = await POST(postRequest(body, signature));
    expect(second.status).toBe(200);
    const invoice = await repos.invoices.getById("inv1");
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(paidAtAfterFirst);
  });

  it("acknowledges (200) an unknown invoice id and changes nothing", async () => {
    const body = invoicePaidBody("evt2", "does-not-exist");
    const signature = await signedHeader(SECRET, body);

    const res = await POST(postRequest(body, signature));
    expect(res.status).toBe(200);
    expect((await repos.invoices.getById("inv1"))?.status).toBe("open");
  });

  it("acknowledges (200) an event of another type and changes nothing", async () => {
    const body = JSON.stringify({
      id: "evt3",
      type: "customer.created",
      data: { object: { metadata: {} } },
    });
    const signature = await signedHeader(SECRET, body);

    const res = await POST(postRequest(body, signature));
    expect(res.status).toBe(200);
    expect((await repos.invoices.getById("inv1"))?.status).toBe("open");
  });
});
