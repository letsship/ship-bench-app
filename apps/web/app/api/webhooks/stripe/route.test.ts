import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Repositories } from "@/lib/db/repos/types";
import { POST } from "./route";

const SECRET = "whsec_test_secret";
const NOW = new Date("2026-03-15T12:00:00.000Z");
const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signedHeader(
  payload: string,
  timestamp = Math.floor(Date.now() / 1000),
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${payload}`),
  );
  return `t=${timestamp},v1=${toHex(new Uint8Array(signature))}`;
}

function postRequest(body: string, signature?: string): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature) headers.set("stripe-signature", signature);
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers,
    body,
  });
}

function invoicePaidPayload(invoiceId: string, id = "evt_1"): string {
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
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    const studio = await repos.studios.getFirst();
    const invoices = await repos.invoices.listByStudio(studio!.id);
    const open = invoices.find((invoice) => invoice.status === "open");
    if (!open) throw new Error("seed has no open invoice");
    openInvoiceId = open.id;
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("marks the invoice paid on a validly signed invoice.paid event", async () => {
    const payload = invoicePaidPayload(openInvoiceId);
    const res = await POST(postRequest(payload, await signedHeader(payload)));

    expect(res.status).toBe(200);
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBeTruthy();
  });

  it("rejects a request with a missing signature and changes nothing", async () => {
    const payload = invoicePaidPayload(openInvoiceId);
    const res = await POST(postRequest(payload));

    expect(res.status).toBe(400);
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });

  it("rejects a request with an invalid signature and changes nothing", async () => {
    const payload = invoicePaidPayload(openInvoiceId);
    const res = await POST(postRequest(payload, "t=1700000000,v1=deadbeef"));

    expect(res.status).toBe(400);
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });

  it("is idempotent: the same event delivered twice marks the invoice paid exactly once", async () => {
    const payload = invoicePaidPayload(openInvoiceId);
    const header = await signedHeader(payload);

    const first = await POST(postRequest(payload, header));
    const second = await POST(postRequest(payload, header));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
  });

  it("acknowledges a verified event naming an unknown invoice and changes nothing", async () => {
    const payload = invoicePaidPayload("nonexistent-id");
    const res = await POST(postRequest(payload, await signedHeader(payload)));

    expect(res.status).toBe(200);
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });

  it("acknowledges a verified event of another type and changes nothing", async () => {
    const payload = JSON.stringify({
      id: "evt_other",
      type: "invoice.voided",
      data: { object: { metadata: { invoice_id: openInvoiceId } } },
    });
    const res = await POST(postRequest(payload, await signedHeader(payload)));

    expect(res.status).toBe(200);
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });
});
