import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const SECRET = "whsec_test_secret";
const URL = "http://localhost/api/webhooks/stripe";

function sign(rawBody: string, secret: string, timestamp = "1700000000"): string {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function signedRequest(rawBody: string, header: string | null): NextRequest {
  const headers: Record<string, string> = {};
  if (header) headers["stripe-signature"] = header;
  return new NextRequest(URL, { method: "POST", body: rawBody, headers });
}

function invoicePaidEvent(id: string, invoiceId: string): string {
  return JSON.stringify({
    id,
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  });
}

describe("POST /api/webhooks/stripe", () => {
  let repos: Repositories;
  let openInvoiceId: string;

  beforeEach(async () => {
    const seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    __setTestRepositories(repos);
    const invoices = await repos.invoices.listByStudio(seed.studio.id);
    const openInvoice = invoices.find((invoice) => invoice.status === "open");
    if (!openInvoice) throw new Error("seed has no open invoice to test against");
    openInvoiceId = openInvoice.id;
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("rejects a missing signature with 400 and changes nothing", async () => {
    const rawBody = invoicePaidEvent("evt_1", openInvoiceId);
    const res = await POST(signedRequest(rawBody, null));
    expect(res.status).toBe(400);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });

  it("rejects an invalid signature with 400 and changes nothing", async () => {
    const rawBody = invoicePaidEvent("evt_1", openInvoiceId);
    const res = await POST(signedRequest(rawBody, sign(rawBody, "wrong-secret")));
    expect(res.status).toBe(400);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });

  it("marks the invoice paid on a verified invoice.paid event", async () => {
    const rawBody = invoicePaidEvent("evt_1", openInvoiceId);
    const res = await POST(signedRequest(rawBody, sign(rawBody, SECRET)));
    expect(res.status).toBe(200);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).not.toBeNull();
  });

  it("is idempotent: replaying the same event leaves the invoice paid once", async () => {
    const rawBody = invoicePaidEvent("evt_1", openInvoiceId);
    const header = sign(rawBody, SECRET);

    const first = await POST(signedRequest(rawBody, header));
    expect(first.status).toBe(200);
    const firstPaidAt = (await repos.invoices.getById(openInvoiceId))?.paidAt;

    const second = await POST(signedRequest(rawBody, header));
    expect(second.status).toBe(200);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(firstPaidAt);
  });

  it("acknowledges a verified event naming an unknown invoice with no change", async () => {
    const rawBody = invoicePaidEvent("evt_2", "inv_does_not_exist");
    const res = await POST(signedRequest(rawBody, sign(rawBody, SECRET)));
    expect(res.status).toBe(200);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });

  it("acknowledges a verified event of another type with no change", async () => {
    const rawBody = JSON.stringify({
      id: "evt_3",
      type: "invoice.payment_failed",
      data: { object: { metadata: { invoice_id: openInvoiceId } } },
    });
    const res = await POST(signedRequest(rawBody, sign(rawBody, SECRET)));
    expect(res.status).toBe(200);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });
});
