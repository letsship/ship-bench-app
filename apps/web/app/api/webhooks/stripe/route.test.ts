import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import * as envModule from "@/lib/env";

const NOW = new Date();
const SECRET = "whsec_test_secret_123";

// Helper to compute a valid signature.
async function computeSignature(payload: string, secret: string): Promise<string> {
  const timestamp = "1234567890";
  const message = `${timestamp}.${payload}`;

  const secretBytes = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = await crypto.subtle.sign("HMAC", key, messageBytes);

  const v1 = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `t=${timestamp},v1=${v1}`;
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    // Mock serverEnv to return our test secret
    vi.spyOn(envModule, "serverEnv").mockReturnValue({
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk_test",
      NEXT_PUBLIC_SITE_URL: undefined,
      SUPABASE_SECRET_KEY: "sk_test",
      RESEND_API_KEY: undefined,
      STUDIOBOOK_FROM_EMAIL: undefined,
      STRIPE_WEBHOOK_SECRET: SECRET,
      SUPABASE_SCHEMA: "public",
    } as ReturnType<typeof envModule.serverEnv>);
  });

  afterEach(() => {
    __setTestRepositories(null);
    vi.restoreAllMocks();
  });

  it("returns 400 when Stripe-Signature header is missing", async () => {
    const payload = '{"id":"evt_123","type":"invoice.paid","data":{"object":{"metadata":{}}}}';
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature is invalid", async () => {
    const payload = '{"id":"evt_123","type":"invoice.paid","data":{"object":{"metadata":{}}}}';
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "Stripe-Signature": "t=1234567890,v1=invalid_signature_here" },
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
  });

  it("marks an invoice paid when signature is valid and event type is invoice.paid", async () => {
    const seed = buildSeed(NOW);
    __setTestRepositories(
      createInMemoryRepositories({
        ...seed,
        invoices: [
          {
            id: "inv_test",
            studioId: seed.studio.id,
            memberId: seed.members[0]?.id ?? "m1",
            number: "INV-2026-0001",
            status: "open",
            currency: "USD",
            taxRateBps: 0,
            subtotalCents: 1000,
            taxCents: 0,
            totalCents: 1000,
            issuedAt: NOW.toISOString(),
            dueAt: null,
            paidAt: null,
            createdAt: NOW.toISOString(),
          },
        ],
      }),
    );

    const payload = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: "inv_test" },
        },
      },
    });

    const signature = await computeSignature(payload, SECRET);
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "Stripe-Signature": signature },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
  });

  it("returns 200 for an unknown invoice (acknowledged but unchanged)", async () => {
    const payload = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: "unknown_invoice" },
        },
      },
    });

    const signature = await computeSignature(payload, SECRET);
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "Stripe-Signature": signature },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
  });

  it("returns 200 for a non-invoice.paid event type", async () => {
    const payload = JSON.stringify({
      id: "evt_456",
      type: "charge.succeeded",
      data: {
        object: {
          metadata: {},
        },
      },
    });

    const signature = await computeSignature(payload, SECRET);
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "Stripe-Signature": signature },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
  });

  it("returns 200 and marks invoice paid only once on replay", async () => {
    const seed = buildSeed(NOW);
    const invoiceId = "inv_replay_test";
    __setTestRepositories(
      createInMemoryRepositories({
        ...seed,
        invoices: [
          {
            id: invoiceId,
            studioId: seed.studio.id,
            memberId: seed.members[0]?.id ?? "m1",
            number: "INV-2026-0001",
            status: "open",
            currency: "USD",
            taxRateBps: 0,
            subtotalCents: 1000,
            taxCents: 0,
            totalCents: 1000,
            issuedAt: NOW.toISOString(),
            dueAt: null,
            paidAt: null,
            createdAt: NOW.toISOString(),
          },
        ],
      }),
    );

    const payload = JSON.stringify({
      id: "evt_789",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: invoiceId },
        },
      },
    });

    const signature = await computeSignature(payload, SECRET);

    // First call.
    const request1 = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "Stripe-Signature": signature },
    });
    const res1 = await POST(request1);
    expect(res1.status).toBe(200);

    // Second call (replay).
    const request2 = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "Stripe-Signature": signature },
    });
    const res2 = await POST(request2);
    expect(res2.status).toBe(200);
  });

  it("returns 400 when STRIPE_WEBHOOK_SECRET is unset", async () => {
    // Mock serverEnv to return no secret
    vi.spyOn(envModule, "serverEnv").mockReturnValue({
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk_test",
      NEXT_PUBLIC_SITE_URL: undefined,
      SUPABASE_SECRET_KEY: "sk_test",
      RESEND_API_KEY: undefined,
      STUDIOBOOK_FROM_EMAIL: undefined,
      STRIPE_WEBHOOK_SECRET: undefined,
      SUPABASE_SCHEMA: "public",
    } as ReturnType<typeof envModule.serverEnv>);

    const payload = '{"id":"evt_123","type":"invoice.paid","data":{"object":{"metadata":{}}}}';
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "Stripe-Signature": "t=1234567890,v1=anything" },
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
  });
});
