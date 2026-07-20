import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { __setTestRepositories } from "@/lib/db/repos";
import { __resetEnvCache } from "@/lib/env";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const TEST_SECRET = "whsec_test_secret";

// Helper: compute HMAC-SHA256 signature for the Stripe webhook format
async function computeSignature(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Helper: create a properly signed Stripe webhook request
async function createSignedRequest(
  payload: string,
  secret: string,
  timestamp: string = Math.floor(Date.now() / 1000).toString(),
): Promise<{ request: NextRequest; timestamp: string }> {
  const message = `${timestamp}.${payload}`;
  const signature = await computeSignature(message, secret);
  const header = `t=${timestamp},v1=${signature}`;

  const request = new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: {
      "Stripe-Signature": header,
      "Content-Type": "application/json",
    },
  });

  return { request, timestamp };
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    __resetEnvCache();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
    process.env.SUPABASE_SECRET_KEY = "test-secret";
    process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET;
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });

  afterEach(() => {
    __resetEnvCache();
    __setTestRepositories(null);
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("receives a valid invoice.paid event and marks the invoice paid", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);

    const studio = (await repos.studios.getFirst())!;
    const invoices = await repos.invoices.listByStudio(studio.id);
    const openInvoice = invoices.find((inv) => inv.status === "open");

    if (!openInvoice) {
      throw new Error("No open invoice found in seed data");
    }

    const payload = JSON.stringify({
      id: "evt_test_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice.id,
          },
        },
      },
    });

    const { request } = await createSignedRequest(payload, TEST_SECRET);
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = (await response.json()) as unknown;
    expect(body).toEqual({ received: true });

    // Verify the invoice is now paid
    const updated = await repos.invoices.getById(openInvoice.id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).not.toBeNull();
  });

  it("rejects a missing Stripe-Signature header with 400", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);

    const studio = (await repos.studios.getFirst())!;
    const invoices = await repos.invoices.listByStudio(studio.id);
    const openInvoice = invoices.find((inv) => inv.status === "open");

    if (!openInvoice) {
      throw new Error("No open invoice found in seed data");
    }

    const payload = JSON.stringify({
      id: "evt_test_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice.id,
          },
        },
      },
    });

    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
    });

    const response = await POST(request);

    expect(response.status).toBe(400);

    // Verify the invoice is unchanged
    const unchanged = await repos.invoices.getById(openInvoice.id);
    expect(unchanged?.status).toBe("open");
    expect(unchanged?.paidAt).toBeNull();
  });

  it("rejects an invalid signature with 400", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);

    const studio = (await repos.studios.getFirst())!;
    const invoices = await repos.invoices.listByStudio(studio.id);
    const openInvoice = invoices.find((inv) => inv.status === "open");

    if (!openInvoice) {
      throw new Error("No open invoice found in seed data");
    }

    const payload = JSON.stringify({
      id: "evt_test_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice.id,
          },
        },
      },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "Stripe-Signature": `t=${timestamp},v1=invalidsignature`,
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);

    // Verify the invoice is unchanged
    const unchanged = await repos.invoices.getById(openInvoice.id);
    expect(unchanged?.status).toBe("open");
  });

  it("is idempotent: processing the same event twice marks paid only once", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);

    const studio = (await repos.studios.getFirst())!;
    const invoices = await repos.invoices.listByStudio(studio.id);
    const openInvoice = invoices.find((inv) => inv.status === "open");

    if (!openInvoice) {
      throw new Error("No open invoice found in seed data");
    }

    const payload = JSON.stringify({
      id: "evt_test_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice.id,
          },
        },
      },
    });

    // First delivery
    const { request: request1, timestamp } = await createSignedRequest(payload, TEST_SECRET);
    const response1 = await POST(request1);
    expect(response1.status).toBe(200);

    const paidAtFirst = (await repos.invoices.getById(openInvoice.id))?.paidAt;
    expect(paidAtFirst).not.toBeNull();

    // Second delivery (same event)
    const { request: request2 } = await createSignedRequest(payload, TEST_SECRET, timestamp);
    const response2 = await POST(request2);
    expect(response2.status).toBe(200);

    // Verify paidAt hasn't changed
    const paidAtSecond = (await repos.invoices.getById(openInvoice.id))?.paidAt;
    expect(paidAtSecond).toBe(paidAtFirst);
  });

  it("acknowledges an event for an unknown invoice with 200", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);

    const payload = JSON.stringify({
      id: "evt_test_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: "nonexistent_id",
          },
        },
      },
    });

    const { request } = await createSignedRequest(payload, TEST_SECRET);
    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it("acknowledges non-invoice.paid events with 200", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);

    const studio = (await repos.studios.getFirst())!;
    const invoices = await repos.invoices.listByStudio(studio.id);
    const invoice = invoices[0];

    const payload = JSON.stringify({
      id: "evt_test_1",
      type: "invoice.created",
      data: {
        object: {
          metadata: {
            invoice_id: invoice.id,
          },
        },
      },
    });

    const { request } = await createSignedRequest(payload, TEST_SECRET);
    const response = await POST(request);

    expect(response.status).toBe(200);

    // Verify nothing changed
    const unchanged = await repos.invoices.getById(invoice.id);
    expect(unchanged?.status).toBe(invoice.status);
  });
});
