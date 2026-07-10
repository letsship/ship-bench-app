import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Invoice } from "@/lib/db/types";
import { POST } from "./route";

const SECRET = "whsec_test_secret";
const NOW = new Date("2026-03-15T12:00:00.000Z");

const invoice: Invoice = {
  id: "inv_1",
  studioId: "s1",
  memberId: "mem_1",
  number: "INV-2026-0001",
  status: "open",
  currency: "EUR",
  taxRateBps: 0,
  subtotalCents: 1000,
  taxCents: 0,
  totalCents: 1000,
  issuedAt: NOW.toISOString(),
  dueAt: null,
  paidAt: null,
  createdAt: NOW.toISOString(),
};

async function signHeader(
  payload: string,
  secret: string,
  timestamp = "1700000000",
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},v1=${hex}`;
}

function postWebhook(body: string, signatureHeader?: string): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signatureHeader) headers["stripe-signature"] = signatureHeader;
  return POST(
    new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers,
      body,
    }),
  );
}

function invoicePaidPayload(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: "evt_1",
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoice.id } } },
    ...over,
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    __setTestRepositories(createInMemoryRepositories());
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    __setTestRepositories(null);
  });

  it("marks the invoice paid on a validly signed invoice.paid event", async () => {
    const repos = createInMemoryRepositories();
    await repos.invoices.insert(invoice);
    __setTestRepositories(repos);

    const payload = invoicePaidPayload();
    const res = await postWebhook(payload, await signHeader(payload, SECRET));

    expect(res.status).toBe(200);
    expect((await repos.invoices.getById(invoice.id))?.status).toBe("paid");
  });

  it("rejects a missing Stripe-Signature header with 400 and changes nothing", async () => {
    const repos = createInMemoryRepositories();
    await repos.invoices.insert(invoice);
    __setTestRepositories(repos);

    const res = await postWebhook(invoicePaidPayload());

    expect(res.status).toBe(400);
    expect((await repos.invoices.getById(invoice.id))?.status).toBe("open");
  });

  it("rejects an invalid/tampered signature with 400 and changes nothing", async () => {
    const repos = createInMemoryRepositories();
    await repos.invoices.insert(invoice);
    __setTestRepositories(repos);

    const payload = invoicePaidPayload();
    const header = await signHeader(payload, SECRET);
    const tampered = invoicePaidPayload({ type: "invoice.tampered" });
    const res = await postWebhook(tampered, header);

    expect(res.status).toBe(400);
    expect((await repos.invoices.getById(invoice.id))?.status).toBe("open");
  });

  it("is idempotent: replaying the same verified event still responds 200 and stays paid once", async () => {
    const repos = createInMemoryRepositories();
    await repos.invoices.insert(invoice);
    __setTestRepositories(repos);

    const payload = invoicePaidPayload();
    const header = await signHeader(payload, SECRET);

    const first = await postWebhook(payload, header);
    expect(first.status).toBe(200);
    const paidAt = (await repos.invoices.getById(invoice.id))?.paidAt;

    const second = await postWebhook(payload, header);
    expect(second.status).toBe(200);

    const updated = await repos.invoices.getById(invoice.id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).toBe(paidAt);
  });

  it("acknowledges a verified event naming an unknown invoice and changes nothing", async () => {
    const repos = createInMemoryRepositories();
    await repos.invoices.insert(invoice);
    __setTestRepositories(repos);

    const payload = JSON.stringify({
      id: "evt_unknown",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "does-not-exist" } } },
    });
    const res = await postWebhook(payload, await signHeader(payload, SECRET));

    expect(res.status).toBe(200);
    expect((await repos.invoices.getById(invoice.id))?.status).toBe("open");
  });

  it("acknowledges a verified event of an unrelated type and changes nothing", async () => {
    const repos = createInMemoryRepositories();
    await repos.invoices.insert(invoice);
    __setTestRepositories(repos);

    const payload = JSON.stringify({
      id: "evt_other",
      type: "payment_intent.succeeded",
      data: { object: { metadata: { invoice_id: invoice.id } } },
    });
    const res = await postWebhook(payload, await signHeader(payload, SECRET));

    expect(res.status).toBe(200);
    expect((await repos.invoices.getById(invoice.id))?.status).toBe("open");
  });
});
