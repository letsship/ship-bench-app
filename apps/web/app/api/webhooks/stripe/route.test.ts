import { createHmac } from "node:crypto";
import { type SeedData } from "@/lib/db/repos/fakes";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { __setTestRepositories, resolveRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const WEBHOOK_SECRET = "whsec_test_secret";

function signPayload(body: string, timestamp: number): string {
  const content = `${timestamp}.${body}`;
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(content).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  const base = buildSeed(NOW);
  return {
    ...base,
    ...over,
  };
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    const base = buildSeed(NOW);
    __setTestRepositories(
      createInMemoryRepositories(
        baseSeed({
          invoices: [
            {
              id: "inv_open",
              studioId: base.studio.id,
              memberId: base.members[0].id,
              number: "INV-2026-0001",
              status: "open",
              currency: "USD",
              taxRateBps: 0,
              subtotalCents: 1000,
              taxCents: 0,
              totalCents: 1000,
              issuedAt: NOW.toISOString(),
              dueAt: new Date(NOW.getTime() + 14 * 86_400_000).toISOString(),
              paidAt: null,
              createdAt: NOW.toISOString(),
            },
          ],
        }),
      ),
    );
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("marks an open invoice paid on a verified invoice.paid event", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: "inv_open",
          },
        },
      },
    });
    const signature = signPayload(body, timestamp);

    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "Stripe-Signature": signature,
      },
      body,
    });

    const response = await POST(request as Request);
    expect(response.status).toBe(200);
    const json = (await response.json()) as unknown;
    expect(json).toEqual({ received: true });

    const repos = await resolveRepositories();
    const invoice = await repos.invoices.getById("inv_open");
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).not.toBeNull();
  });

  it("responds 400 with missing signature header", async () => {
    const body = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "inv_open" } } },
    });

    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body,
    });

    const response = await POST(request as Request);
    expect(response.status).toBe(400);
    const json = (await response.json()) as unknown;
    expect((json as { error: { code: string } }).error.code).toBe("invalid_signature");
  });

  it("responds 400 with invalid signature", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "inv_open" } } },
    });
    const signature = `t=${timestamp},v1=invalid_signature_hex`;

    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "Stripe-Signature": signature,
      },
      body,
    });

    const response = await POST(request as Request);
    expect(response.status).toBe(400);
    const json = (await response.json()) as unknown;
    expect((json as { error: { code: string } }).error.code).toBe("invalid_signature");
  });

  it("responds 200 and changes nothing with invalid signature (no state mutation)", async () => {
    const body = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: "inv_open" } } },
    });
    const signature = `t=1234567890,v1=wrong`;

    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "Stripe-Signature": signature,
      },
      body,
    });

    const response = await POST(request as Request);
    expect(response.status).toBe(400);

    const repos = await resolveRepositories();
    const invoice = await repos.invoices.getById("inv_open");
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });

  it("responds 200 and does nothing for duplicate delivery (idempotent)", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      id: "evt_duplicate",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: "inv_open",
          },
        },
      },
    });
    const signature = signPayload(body, timestamp);

    // First delivery
    const request1 = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "Stripe-Signature": signature },
      body,
    });
    const response1 = await POST(request1 as Request);
    expect(response1.status).toBe(200);

    let repos = await resolveRepositories();
    let invoice = await repos.invoices.getById("inv_open");
    const firstPaidAt = invoice?.paidAt;
    expect(invoice?.status).toBe("paid");

    // Simulate small delay
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Second delivery (duplicate)
    const request2 = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "Stripe-Signature": signature },
      body,
    });
    const response2 = await POST(request2 as Request);
    expect(response2.status).toBe(200);

    repos = await resolveRepositories();
    invoice = await repos.invoices.getById("inv_open");
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(firstPaidAt);
  });

  it("responds 200 for unknown invoice (no-op)", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: "inv_unknown",
          },
        },
      },
    });
    const signature = signPayload(body, timestamp);

    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "Stripe-Signature": signature },
      body,
    });

    const response = await POST(request as Request);
    expect(response.status).toBe(200);
  });

  it("responds 200 for non-invoice.paid events (no-op)", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      id: "evt_123",
      type: "invoice.created",
      data: {
        object: {
          metadata: {
            invoice_id: "inv_open",
          },
        },
      },
    });
    const signature = signPayload(body, timestamp);

    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "Stripe-Signature": signature },
      body,
    });

    const response = await POST(request as Request);
    expect(response.status).toBe(200);

    const repos = await resolveRepositories();
    const invoice = await repos.invoices.getById("inv_open");
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });
});
