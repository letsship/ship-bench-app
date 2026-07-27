import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const SECRET = "whsec_test_secret";

const encoder = new TextEncoder();

async function signedHeader(body: string, secret: string): Promise<string> {
  const timestamp = "1700000000";
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
  const signature = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `t=${timestamp},v1=${signature}`;
}

function stripeEventBody(id: string, type: string, invoiceId: string | undefined): string {
  return JSON.stringify({
    id,
    type,
    data: { object: { metadata: invoiceId === undefined ? {} : { invoice_id: invoiceId } } },
  });
}

function postRequest(body: string, signature: string | null): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature) headers.set("Stripe-Signature", signature);
  return new Request("http://localhost/api/webhooks/stripe", { method: "POST", body, headers });
}

describe("POST /api/webhooks/stripe", () => {
  let repos: Repositories;
  let openInvoiceId: string;

  beforeEach(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    const studio = await repos.studios.getFirst();
    if (!studio) throw new Error("expected a seeded studio");
    const invoices = await repos.invoices.listByStudio(studio.id);
    const open = invoices.find((invoice) => invoice.status === "open");
    if (!open) throw new Error("expected a seeded open invoice");
    openInvoiceId = open.id;
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("marks the invoice paid on a validly signed invoice.paid event", async () => {
    const body = stripeEventBody("evt_1", "invoice.paid", openInvoiceId);
    const res = await POST(postRequest(body, await signedHeader(body, SECRET)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).not.toBeNull();
  });

  it("rejects a missing signature with 400 and changes nothing", async () => {
    const body = stripeEventBody("evt_2", "invoice.paid", openInvoiceId);
    const res = await POST(postRequest(body, null));
    expect(res.status).toBe(400);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });

  it("rejects an invalid signature with 400 and changes nothing", async () => {
    const body = stripeEventBody("evt_3", "invoice.paid", openInvoiceId);
    const res = await POST(postRequest(body, await signedHeader(body, "whsec_wrong_secret")));
    expect(res.status).toBe(400);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });

  it("is idempotent: replaying the same event leaves the invoice paid once", async () => {
    const body = stripeEventBody("evt_4", "invoice.paid", openInvoiceId);
    const header = await signedHeader(body, SECRET);

    const first = await POST(postRequest(body, header));
    expect(first.status).toBe(200);
    const firstPaidAt = (await repos.invoices.getById(openInvoiceId))?.paidAt;

    const second = await POST(postRequest(body, header));
    expect(second.status).toBe(200);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(firstPaidAt);
  });

  it("acknowledges an unknown invoice id with 200 and changes nothing", async () => {
    const body = stripeEventBody("evt_5", "invoice.paid", "does-not-exist");
    const res = await POST(postRequest(body, await signedHeader(body, SECRET)));
    expect(res.status).toBe(200);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });

  it("acknowledges a different event type with 200 and changes nothing", async () => {
    const body = stripeEventBody("evt_6", "invoice.voided", openInvoiceId);
    const res = await POST(postRequest(body, await signedHeader(body, SECRET)));
    expect(res.status).toBe(200);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });
});
