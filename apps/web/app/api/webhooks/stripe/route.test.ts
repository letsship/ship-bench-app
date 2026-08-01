import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const SECRET = "whsec_route_test";
const encoder = new TextEncoder();

async function signatureFor(body: string, timestamp = "1785585600"): Promise<string> {
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

function eventBody(invoiceId: string, type = "invoice.paid"): string {
  return JSON.stringify({
    id: `evt_${type.replaceAll(".", "_")}`,
    type,
    data: { object: { metadata: { invoice_id: invoiceId } } },
  });
}

describe("POST /api/webhooks/stripe", () => {
  let repositories: ReturnType<typeof createInMemoryRepositories>;
  let invoiceId: string;
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    const seed = buildSeed(NOW);
    repositories = createInMemoryRepositories(seed);
    invoiceId = seed.invoices[0].id;
    __setTestRepositories(repositories);
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    __setTestRepositories(null);
    if (originalSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  });

  async function post(body: string, signature?: string): Promise<Response> {
    return POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body,
        headers: signature ? { "Stripe-Signature": signature } : undefined,
      }),
    );
  }

  it("rejects a missing signature without changing the invoice", async () => {
    const response = await post(eventBody(invoiceId));
    expect(response.status).toBe(400);
    expect((await repositories.invoices.getById(invoiceId))?.status).toBe("open");
  });

  it("rejects an invalid signature without changing the invoice", async () => {
    const response = await post(eventBody(invoiceId), "t=1785585600,v1=invalid");
    expect(response.status).toBe(400);
    expect((await repositories.invoices.getById(invoiceId))?.status).toBe("open");
  });

  it("marks a verified invoice.paid event paid", async () => {
    const body = eventBody(invoiceId);
    const response = await post(body, await signatureFor(body));
    expect(response.status).toBe(200);
    expect((await repositories.invoices.getById(invoiceId))?.status).toBe("paid");
  });

  it("acknowledges duplicate delivery without changing paidAt", async () => {
    const body = eventBody(invoiceId);
    const signature = await signatureFor(body);
    expect((await post(body, signature)).status).toBe(200);
    const firstPaidAt = (await repositories.invoices.getById(invoiceId))?.paidAt;
    expect((await post(body, signature)).status).toBe(200);
    expect((await repositories.invoices.getById(invoiceId))?.paidAt).toBe(firstPaidAt);
  });

  it("acknowledges an unknown invoice without changing anything", async () => {
    const body = eventBody("missing-invoice");
    expect((await post(body, await signatureFor(body))).status).toBe(200);
    expect((await repositories.invoices.getById(invoiceId))?.status).toBe("open");
  });

  it("acknowledges other verified event types without changing anything", async () => {
    const body = eventBody(invoiceId, "payment_intent.succeeded");
    expect((await post(body, await signatureFor(body))).status).toBe(200);
    expect((await repositories.invoices.getById(invoiceId))?.status).toBe("open");
  });
});
