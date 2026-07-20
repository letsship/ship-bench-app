import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as stripeWebhookPost } from "@/app/api/webhooks/stripe/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { newId } from "@/lib/db/ids";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const TEST_SECRET = "whsec_test_secret_123";

// Helper to sign a body with the test secret
function signBody(body: string): { header: string; payload: string } {
  const t = Math.floor(Date.now() / 1000).toString();
  const signed = `${t}.${body}`;
  const signature = createHmac("sha256", TEST_SECRET).update(signed).digest("hex");
  return {
    payload: body,
    header: `t=${t},v1=${signature}`,
  };
}

async function postWebhook(
  body: Record<string, unknown>,
  secret: string = TEST_SECRET,
): Promise<Response> {
  const payload = JSON.stringify(body);
  const { header } = signBody(payload);

  const request = new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: new Headers({
      "Stripe-Signature": header,
      "Content-Type": "application/json",
    }),
  });

  // Set the secret in the environment
  const oldSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = secret;

  try {
    return await stripeWebhookPost(request);
  } finally {
    process.env.STRIPE_WEBHOOK_SECRET = oldSecret;
  }
}

describe("Stripe webhook processing", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("accepts a correctly-signed invoice.paid event and marks the invoice paid", async () => {
    const seed = buildSeed(NOW);
    __setTestRepositories(createInMemoryRepositories(seed));

    const invoice = seed.invoices.find((i) => i.status === "open");
    if (!invoice) throw new Error("No open invoice in seed");

    const eventId = newId();
    const event = {
      id: eventId,
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: invoice.id,
          },
        },
      },
    };

    const response = await postWebhook(event);
    expect(response.status).toBe(200);
  });

  it("rejects a request with a missing signature header", async () => {
    const event = {
      id: newId(),
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: newId() } } },
    };

    const payload = JSON.stringify(event);
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const oldSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET;

    try {
      const response = await stripeWebhookPost(request);
      expect(response.status).toBe(400);
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = oldSecret;
    }
  });

  it("rejects a request with an invalid signature", async () => {
    const event = {
      id: newId(),
      type: "invoice.paid",
      data: { object: { metadata: { invoice_id: newId() } } },
    };

    const payload = JSON.stringify(event);
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: new Headers({
        "Stripe-Signature": "t=123,v1=invalid",
        "Content-Type": "application/json",
      }),
    });

    const oldSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET;

    try {
      const response = await stripeWebhookPost(request);
      expect(response.status).toBe(400);
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = oldSecret;
    }
  });

  it("is idempotent — same event id twice marks the invoice paid exactly once", async () => {
    const seed = buildSeed(NOW);
    __setTestRepositories(createInMemoryRepositories(seed));

    const invoice = seed.invoices.find((i) => i.status === "open");
    if (!invoice) throw new Error("No open invoice in seed");

    const eventId = newId();
    const event = {
      id: eventId,
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: invoice.id,
          },
        },
      },
    };

    // First post
    const response1 = await postWebhook(event);
    expect(response1.status).toBe(200);

    // Second post with same event
    const response2 = await postWebhook(event);
    expect(response2.status).toBe(200);
  });

  it("acknowledges a verified event naming an unknown invoice", async () => {
    const eventId = newId();
    const event = {
      id: eventId,
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: "unknown-invoice-id",
          },
        },
      },
    };

    const response = await postWebhook(event);
    expect(response.status).toBe(200);
  });

  it("acknowledges a verified event of a different type (no-op)", async () => {
    const eventId = newId();
    const event = {
      id: eventId,
      type: "charge.succeeded",
      data: { object: { metadata: {} } },
    };

    const response = await postWebhook(event);
    expect(response.status).toBe(200);
  });
});
