import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice } from "@/lib/db/types";

const TEST_SECRET = "whsec_route_test_secret";
const NOW = new Date("2026-03-15T12:00:00.000Z");
const encoder = new TextEncoder();

async function signedHeader(payload: string, secret: string, timestamp: number): Promise<string> {
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
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},v1=${hex}`;
}

function invoicePaidEvent(id: string, invoiceId: string): string {
  return JSON.stringify({
    id,
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  });
}

function postWebhook(payload: string, signature: string | null): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature) headers.set("Stripe-Signature", signature);
  return POST(
    new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers,
      body: payload,
    }),
  );
}

describe("POST /api/webhooks/stripe", () => {
  let repos: Repositories;
  let openInvoice: Invoice;

  beforeEach(async () => {
    // serverEnv() parses the whole server schema, so the route needs every
    // required var set, not just the Stripe secret — these values are unused
    // by the handler itself (repos are injected via __setTestRepositories).
    process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_test";
    process.env.SUPABASE_SECRET_KEY ??= "sb_secret_test";
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    const studio = await repos.studios.getFirst();
    const invoices = await repos.invoices.listByStudio(studio?.id ?? "");
    const found = invoices.find((invoice) => invoice.status === "open");
    if (!found) throw new Error("seed data must include an open invoice");
    openInvoice = found;
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("rejects a missing signature header with 400 and changes nothing", async () => {
    const payload = invoicePaidEvent("evt_missing", openInvoice.id);
    const res = await postWebhook(payload, null);
    expect(res.status).toBe(400);
    const stored = await repos.invoices.getById(openInvoice.id);
    expect(stored?.status).toBe("open");
  });

  it("rejects a tampered/invalid signature with 400 and changes nothing", async () => {
    const payload = invoicePaidEvent("evt_tampered", openInvoice.id);
    const header = await signedHeader(payload, "wrong-secret", Math.floor(Date.now() / 1000));
    const res = await postWebhook(payload, header);
    expect(res.status).toBe(400);
    const stored = await repos.invoices.getById(openInvoice.id);
    expect(stored?.status).toBe("open");
  });

  it("marks a real open invoice paid on a verified invoice.paid event", async () => {
    const payload = invoicePaidEvent("evt_paid_1", openInvoice.id);
    const header = await signedHeader(payload, TEST_SECRET, Math.floor(Date.now() / 1000));
    const res = await postWebhook(payload, header);
    expect(res.status).toBe(200);
    const stored = await repos.invoices.getById(openInvoice.id);
    expect(stored?.status).toBe("paid");
    expect(stored?.paidAt).not.toBeNull();
  });

  it("is idempotent when the same event is delivered twice", async () => {
    const payload = invoicePaidEvent("evt_replay", openInvoice.id);
    const header = await signedHeader(payload, TEST_SECRET, Math.floor(Date.now() / 1000));

    const first = await postWebhook(payload, header);
    const second = await postWebhook(payload, header);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const stored = await repos.invoices.getById(openInvoice.id);
    expect(stored?.status).toBe("paid");
  });

  it("acknowledges a verified event naming an unknown invoice and changes nothing", async () => {
    const payload = invoicePaidEvent("evt_unknown_invoice", "unknown-invoice-id");
    const header = await signedHeader(payload, TEST_SECRET, Math.floor(Date.now() / 1000));
    const res = await postWebhook(payload, header);
    expect(res.status).toBe(200);
    const stored = await repos.invoices.getById(openInvoice.id);
    expect(stored?.status).toBe("open");
  });

  it("acknowledges a verified event of another type and changes nothing", async () => {
    const payload = JSON.stringify({
      id: "evt_other_type",
      type: "invoice.created",
      data: { object: { metadata: { invoice_id: openInvoice.id } } },
    });
    const header = await signedHeader(payload, TEST_SECRET, Math.floor(Date.now() / 1000));
    const res = await postWebhook(payload, header);
    expect(res.status).toBe(200);
    const stored = await repos.invoices.getById(openInvoice.id);
    expect(stored?.status).toBe("open");
  });
});
