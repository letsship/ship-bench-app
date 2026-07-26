import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice } from "@/lib/db/types";
import { POST } from "./route";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const ISO = NOW.toISOString();
const SECRET = "whsec_test_secret";
const encoder = new TextEncoder();

function baseSeed(invoices: Invoice[]): SeedData {
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
    invoices,
    lineItems: [],
    outbox: [],
  };
}

const invoice = (id: string, status: string): Invoice => ({
  id,
  studioId: "s1",
  memberId: "m1",
  number: "INV-2026-0001",
  status,
  currency: "EUR",
  taxRateBps: 900,
  subtotalCents: 1000,
  taxCents: 90,
  totalCents: 1090,
  issuedAt: ISO,
  dueAt: null,
  paidAt: null,
  createdAt: ISO,
});

async function sign(secret: string, timestamp: string, payload: string): Promise<string> {
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
    encoder.encode(`${timestamp}.${payload}`),
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function signedRequest(payload: string, secret = SECRET): Promise<NextRequest> {
  const timestamp = "1700000000";
  const signature = await sign(secret, timestamp, payload);
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
  });
}

function invoicePaidPayload(eventId: string, invoiceId: string): string {
  return JSON.stringify({
    id: eventId,
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  });
}

describe("POST /api/webhooks/stripe", () => {
  let repos: Repositories;

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    repos = createInMemoryRepositories(baseSeed([invoice("inv_1", "open")]));
    __setTestRepositories(repos);
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    __setTestRepositories(null);
  });

  it("rejects a missing Stripe-Signature header with 400 and changes nothing", async () => {
    const payload = invoicePaidPayload("evt_1", "inv_1");
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
    });
    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(await repos.invoices.getById("inv_1")).toMatchObject({ status: "open", paidAt: null });
  });

  it("rejects an invalid signature with 400 and changes nothing", async () => {
    const payload = invoicePaidPayload("evt_1", "inv_1");
    const request = await signedRequest(payload, "wrong_secret");
    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(await repos.invoices.getById("inv_1")).toMatchObject({ status: "open", paidAt: null });
  });

  it("marks the named invoice paid on a correctly-signed invoice.paid event", async () => {
    const request = await signedRequest(invoicePaidPayload("evt_1", "inv_1"));
    const res = await POST(request);
    expect(res.status).toBe(200);
    const updated = await repos.invoices.getById("inv_1");
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).not.toBeNull();
  });

  it("does not double-process a replayed event", async () => {
    const payload = invoicePaidPayload("evt_1", "inv_1");
    const first = await POST(await signedRequest(payload));
    expect(first.status).toBe(200);
    const firstPaidAt = (await repos.invoices.getById("inv_1"))?.paidAt;

    const second = await POST(await signedRequest(payload));
    expect(second.status).toBe(200);
    const updated = await repos.invoices.getById("inv_1");
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).toBe(firstPaidAt);
  });

  it("acknowledges a signed event for an unknown invoice and changes nothing", async () => {
    const request = await signedRequest(invoicePaidPayload("evt_2", "inv_missing"));
    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(await repos.invoices.getById("inv_1")).toMatchObject({ status: "open", paidAt: null });
  });

  it("acknowledges a signed event of another type and changes nothing", async () => {
    const payload = JSON.stringify({ id: "evt_3", type: "customer.created", data: { object: {} } });
    const request = await signedRequest(payload);
    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(await repos.invoices.getById("inv_1")).toMatchObject({ status: "open", paidAt: null });
  });
});
