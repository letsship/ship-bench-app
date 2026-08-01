import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as stripeWebhookPost } from "@/app/api/webhooks/stripe/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Invoice } from "@/lib/db/types";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const SECRET = "whsec_route_test_secret";

// The route reads the signing secret through serverEnv(), which validates the
// whole server schema — stub the required Supabase vars so the lazy parse
// succeeds. Vitest isolates test files, so this never leaks into other suites.
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
process.env.SUPABASE_SECRET_KEY = "test-secret-key";
process.env.STRIPE_WEBHOOK_SECRET = SECRET;

function signatureFor(body: string, secret: string = SECRET, timestamp = "1710504000"): string {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function webhookRequest(body: string, signature?: string): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

function invoicePaidBody(eventId: string, invoiceId: string): string {
  return JSON.stringify({
    id: eventId,
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  });
}

describe("POST /api/webhooks/stripe", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  async function openInvoice(): Promise<Invoice> {
    const studio = await repos.studios.getFirst();
    if (!studio) throw new Error("Seed studio missing");
    const invoices = await repos.invoices.listByStudio(studio.id);
    const open = invoices.find((row) => row.status === "open");
    if (!open) throw new Error("Expected a seeded open invoice");
    return open;
  }

  it("rejects a request without a signature and changes nothing", async () => {
    const open = await openInvoice();
    const res = await stripeWebhookPost(webhookRequest(invoicePaidBody("evt_1", open.id)));
    expect(res.status).toBe(400);
    expect((await repos.invoices.getById(open.id))?.status).toBe("open");
  });

  it("rejects an invalid signature and changes nothing", async () => {
    const open = await openInvoice();
    const body = invoicePaidBody("evt_2", open.id);
    const res = await stripeWebhookPost(
      webhookRequest(body, signatureFor(body, "whsec_wrong_secret")),
    );
    expect(res.status).toBe(400);
    expect((await repos.invoices.getById(open.id))?.status).toBe("open");
  });

  it("rejects a signature over a different body and changes nothing", async () => {
    const open = await openInvoice();
    const body = invoicePaidBody("evt_3", open.id);
    const res = await stripeWebhookPost(webhookRequest(body, signatureFor(`${body} `)));
    expect(res.status).toBe(400);
    expect((await repos.invoices.getById(open.id))?.status).toBe("open");
  });

  it("marks the invoice paid on a verified invoice.paid event", async () => {
    const open = await openInvoice();
    const body = invoicePaidBody("evt_4", open.id);
    const res = await stripeWebhookPost(webhookRequest(body, signatureFor(body)));
    expect(res.status).toBe(200);
    const updated = await repos.invoices.getById(open.id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).not.toBeNull();
  });

  it("acknowledges a duplicate event without double-processing", async () => {
    const open = await openInvoice();
    const body = invoicePaidBody("evt_5", open.id);
    const first = await stripeWebhookPost(webhookRequest(body, signatureFor(body)));
    expect(first.status).toBe(200);
    const afterFirst = await repos.invoices.getById(open.id);
    const second = await stripeWebhookPost(webhookRequest(body, signatureFor(body)));
    expect(second.status).toBe(200);
    const afterSecond = await repos.invoices.getById(open.id);
    expect(afterSecond?.status).toBe("paid");
    expect(afterSecond?.paidAt).toBe(afterFirst?.paidAt);
  });

  it("acknowledges an event for an unknown invoice without changes", async () => {
    const open = await openInvoice();
    const body = invoicePaidBody("evt_6", "missing-invoice-id");
    const res = await stripeWebhookPost(webhookRequest(body, signatureFor(body)));
    expect(res.status).toBe(200);
    expect((await repos.invoices.getById(open.id))?.status).toBe("open");
  });

  it("acknowledges other event types without changes", async () => {
    const open = await openInvoice();
    const body = JSON.stringify({
      id: "evt_7",
      type: "payment_intent.succeeded",
      data: { object: { metadata: { invoice_id: open.id } } },
    });
    const res = await stripeWebhookPost(webhookRequest(body, signatureFor(body)));
    expect(res.status).toBe(200);
    expect((await repos.invoices.getById(open.id))?.status).toBe("open");
  });
});
