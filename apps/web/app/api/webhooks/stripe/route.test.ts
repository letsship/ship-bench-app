import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { __setTestRepositories } from "@/lib/db/repos";

const encoder = new TextEncoder();

async function computeSignature(
  timestamp: string,
  payload: string,
  secret: string,
): Promise<string> {
  const message = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

describe("POST /api/webhooks/stripe", () => {
  const testSecret = "whsec_test_secret_123";
  let repos = createInMemoryRepositories(buildSeed());

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed());
    __setTestRepositories(repos);
    process.env.STRIPE_WEBHOOK_SECRET = testSecret;
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("marks invoice paid on valid invoice.paid event", async () => {
    const seed = buildSeed();
    const invoice = seed.invoices.find((i) => i.status === "open")!;
    repos = createInMemoryRepositories({ ...seed, invoices: [invoice] });
    __setTestRepositories(repos);

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify({
      id: "evt_test_valid",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: invoice.id } } },
    });
    const signature = await computeSignature(timestamp, payload, testSecret);

    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${timestamp},v1=${signature}`,
      },
      body: payload,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const updated = await repos.invoices.getById(invoice.id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).toBeTruthy();
  });

  it("rejects missing signature", async () => {
    const seed = buildSeed();
    const invoice = seed.invoices.find((i) => i.status === "open")!;
    repos = createInMemoryRepositories({ ...seed, invoices: [invoice] });
    __setTestRepositories(repos);

    const payload = JSON.stringify({
      id: "evt_test_no_sig",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: invoice.id } } },
    });

    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const updated = await repos.invoices.getById(invoice.id);
    expect(updated?.status).toBe("open");
  });

  it("rejects invalid signature", async () => {
    const seed = buildSeed();
    const invoice = seed.invoices.find((i) => i.status === "open")!;
    repos = createInMemoryRepositories({ ...seed, invoices: [invoice] });
    __setTestRepositories(repos);

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify({
      id: "evt_test_bad_sig",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: invoice.id } } },
    });

    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${timestamp},v1=invalidsignature`,
      },
      body: payload,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const updated = await repos.invoices.getById(invoice.id);
    expect(updated?.status).toBe("open");
  });

  it("redelivery of same event is idempotent", async () => {
    const seed = buildSeed();
    const invoice = seed.invoices.find((i) => i.status === "open")!;
    repos = createInMemoryRepositories({ ...seed, invoices: [invoice] });
    __setTestRepositories(repos);

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const eventId = "evt_test_redelivery";
    const payload = JSON.stringify({
      id: eventId,
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: invoice.id } } },
    });
    const signature = await computeSignature(timestamp, payload, testSecret);

    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${timestamp},v1=${signature}`,
      },
      body: payload,
    });

    const response1 = await POST(request);
    expect(response1.status).toBe(200);
    const firstPaidAt = (await repos.invoices.getById(invoice.id))?.paidAt;

    const request2 = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${timestamp},v1=${signature}`,
      },
      body: payload,
    });

    const response2 = await POST(request2);
    expect(response2.status).toBe(200);
    const secondPaidAt = (await repos.invoices.getById(invoice.id))?.paidAt;

    expect(firstPaidAt).toBe(secondPaidAt);
  });

  it("acknowledges other event types with 200", async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify({
      id: "evt_test_other",
      type: "customer.created",
      data: { object: { metadata: {} } },
    });
    const signature = await computeSignature(timestamp, payload, testSecret);

    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${timestamp},v1=${signature}`,
      },
      body: payload,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it("acknowledges unknown invoice with 200", async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify({
      id: "evt_test_unknown_invoice",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "unknown_invoice_id" } } },
    });
    const signature = await computeSignature(timestamp, payload, testSecret);

    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${timestamp},v1=${signature}`,
      },
      body: payload,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
