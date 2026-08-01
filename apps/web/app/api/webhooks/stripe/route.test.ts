import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";

const encoder = new TextEncoder();
const NOW = new Date("2026-08-01T12:00:00.000Z");
const SECRET = "whsec_route_test";
const TIMESTAMP = "1770000000";
const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function signatureFor(rawBody: string): Promise<string> {
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
    encoder.encode(`${TIMESTAMP}.${rawBody}`),
  );
  const hex = Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `t=${TIMESTAMP},v1=${hex}`;
}

async function webhookRequest(event: object, signature?: string): Promise<Response> {
  const rawBody = JSON.stringify(event);
  const headers = new Headers({ "content-type": "application/json" });
  if (signature) headers.set("Stripe-Signature", signature);
  return POST(
    new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers,
      body: rawBody,
    }),
  );
}

async function signedWebhookRequest(event: object): Promise<Response> {
  const rawBody = JSON.stringify(event);
  return webhookRequest(event, await signatureFor(rawBody));
}

function event(type: string, invoiceId?: string): object {
  return {
    id: "evt_route_test",
    type,
    data: { object: invoiceId ? { metadata: { invoice_id: invoiceId } } : {} },
  };
}

describe("POST /api/webhooks/stripe", () => {
  let repos: Repositories;
  let openInvoiceId: string;

  beforeEach(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    const studio = await repos.studios.getFirst();
    const invoices = await repos.invoices.listByStudio(studio?.id ?? "");
    openInvoiceId = invoices.find((invoice) => invoice.status === "open")?.id ?? "";
  });

  afterEach(() => {
    __setTestRepositories(null);
    if (originalSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  });

  it("rejects missing and invalid signatures without changing the invoice", async () => {
    const paidEvent = event("invoice.paid", openInvoiceId);
    const missing = await webhookRequest(paidEvent);
    const invalid = await webhookRequest(paidEvent, `t=${TIMESTAMP},v1=invalid`);

    expect(missing.status).toBe(400);
    expect(invalid.status).toBe(400);
    expect((await repos.invoices.getById(openInvoiceId))?.status).toBe("open");
  });

  it("marks an invoice paid for a valid invoice.paid event", async () => {
    const response = await signedWebhookRequest(event("invoice.paid", openInvoiceId));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).not.toBeNull();
  });

  it("acknowledges duplicate delivery and updates the invoice once", async () => {
    const update = vi.spyOn(repos.invoices, "update");
    const paidEvent = event("invoice.paid", openInvoiceId);

    const first = await signedWebhookRequest(paidEvent);
    const firstPaidAt = (await repos.invoices.getById(openInvoiceId))?.paidAt;
    const second = await signedWebhookRequest(paidEvent);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect((await repos.invoices.getById(openInvoiceId))?.paidAt).toBe(firstPaidAt);
  });

  it("acknowledges an unknown invoice without changing invoices", async () => {
    const update = vi.spyOn(repos.invoices, "update");
    const response = await signedWebhookRequest(event("invoice.paid", "missing-invoice"));

    expect(response.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });

  it("acknowledges another event type without changing invoices", async () => {
    const update = vi.spyOn(repos.invoices, "update");
    const response = await signedWebhookRequest(event("invoice.created", openInvoiceId));

    expect(response.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });
});
