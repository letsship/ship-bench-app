import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { POST } from "./route";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const SECRET = "whsec_test_secret_for_route";
const encoder = new TextEncoder();

async function signatureHeaderFor(body: string, timestamp = "1700000000"): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
  const hex = Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `t=${timestamp},v1=${hex}`;
}

function postRequest(body: string, signatureHeader: string | null): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (signatureHeader) headers.set("stripe-signature", signatureHeader);
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers,
    body,
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
  let openInvoiceId: string;

  beforeEach(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    __setTestRepositories(repos);
    const invoices = await repos.invoices.listByStudio(seed.studio.id);
    const open = invoices.find((invoice) => invoice.status === "open");
    if (!open) throw new Error("expected an open invoice in the seed data");
    openInvoiceId = open.id;
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("marks the invoice paid on a validly signed invoice.paid event", async () => {
    const body = invoicePaidBody("evt_route_1", openInvoiceId);
    const res = await POST(postRequest(body, await signatureHeaderFor(body)));
    expect(res.status).toBe(200);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBeTruthy();
  });

  it("returns 400 and changes nothing when the signature header is missing", async () => {
    const body = invoicePaidBody("evt_route_2", openInvoiceId);
    const res = await POST(postRequest(body, null));
    expect(res.status).toBe(400);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });

  it("returns 400 and changes nothing when the signature is invalid", async () => {
    const body = invoicePaidBody("evt_route_3", openInvoiceId);
    const res = await POST(postRequest(body, "t=1700000000,v1=deadbeef"));
    expect(res.status).toBe(400);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });

  it("is idempotent: replaying the identical event returns 200 and marks paid exactly once", async () => {
    const body = invoicePaidBody("evt_route_4", openInvoiceId);
    const signature = await signatureHeaderFor(body);

    const first = await POST(postRequest(body, signature));
    expect(first.status).toBe(200);
    const firstPaidAt = (await repos.invoices.getById(openInvoiceId))?.paidAt;

    const second = await POST(postRequest(body, signature));
    expect(second.status).toBe(200);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(firstPaidAt);
  });

  it("acknowledges (200) a verified event naming an unknown invoice, with no changes", async () => {
    const body = invoicePaidBody("evt_route_5", "does-not-exist");
    const res = await POST(postRequest(body, await signatureHeaderFor(body)));
    expect(res.status).toBe(200);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });

  it("acknowledges (200) a verified event of another type, with no changes", async () => {
    const body = JSON.stringify({
      id: "evt_route_6",
      type: "invoice.payment_failed",
      data: { object: { metadata: { invoice_id: openInvoiceId } } },
    });
    const res = await POST(postRequest(body, await signatureHeaderFor(body)));
    expect(res.status).toBe(200);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });
});
