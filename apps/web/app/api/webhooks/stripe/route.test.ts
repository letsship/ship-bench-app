import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Repositories } from "@/lib/db/repos/types";
import { POST } from "./route";

const SECRET = "whsec_test_secret";
const TIMESTAMP = "1700000000";
const NOW = new Date("2026-03-15T12:00:00.000Z");
let originalSecret: string | undefined;
let repos: Repositories;
let invoiceId: string;

function eventBody(id: string, type: string, targetInvoiceId?: string): string {
  return JSON.stringify({
    id,
    type,
    data: { object: { metadata: targetInvoiceId ? { invoice_id: targetInvoiceId } : {} } },
  });
}

function signedRequest(body: string, signature = signatureFor(body)): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: { "Stripe-Signature": `t=${TIMESTAMP},v1=${signature}` },
  });
}

function signatureFor(body: string): string {
  return createHmac("sha256", SECRET).update(`${TIMESTAMP}.${body}`).digest("hex");
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    invoiceId = seed.invoices.find((invoice) => invoice.status === "open")?.id ?? "";
    __setTestRepositories(repos);
  });

  afterEach(() => {
    __setTestRepositories(null);
    if (originalSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  });

  it("rejects a missing signature without changing the invoice", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: eventBody("evt_missing", "invoice.paid", invoiceId),
      }),
    );

    expect(response.status).toBe(400);
    expect((await repos.invoices.getById(invoiceId))?.status).toBe("open");
  });

  it("rejects an invalid signature without changing the invoice", async () => {
    const response = await POST(
      signedRequest(eventBody("evt_invalid", "invoice.paid", invoiceId), "0".repeat(64)),
    );

    expect(response.status).toBe(400);
    expect((await repos.invoices.getById(invoiceId))?.status).toBe("open");
  });

  it("marks an invoice paid for a valid invoice.paid event", async () => {
    const response = await POST(signedRequest(eventBody("evt_paid", "invoice.paid", invoiceId)));

    expect(response.status).toBe(200);
    expect(await repos.invoices.getById(invoiceId)).toMatchObject({ status: "paid" });
  });

  it("acknowledges duplicate deliveries without processing them twice", async () => {
    const requestBody = eventBody("evt_duplicate", "invoice.paid", invoiceId);
    expect((await POST(signedRequest(requestBody))).status).toBe(200);
    const paidAt = (await repos.invoices.getById(invoiceId))?.paidAt;

    expect((await POST(signedRequest(requestBody))).status).toBe(200);
    expect((await repos.invoices.getById(invoiceId))?.paidAt).toBe(paidAt);
  });

  it("acknowledges a valid event for an unknown invoice", async () => {
    const response = await POST(signedRequest(eventBody("evt_unknown", "invoice.paid", "inv_missing")));

    expect(response.status).toBe(200);
    expect((await repos.invoices.getById(invoiceId))?.status).toBe("open");
  });

  it("acknowledges a valid event of another type", async () => {
    const response = await POST(signedRequest(eventBody("evt_other", "invoice.created", invoiceId)));

    expect(response.status).toBe(200);
    expect((await repos.invoices.getById(invoiceId))?.status).toBe("open");
  });
});
