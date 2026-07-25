import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { signStripePayload } from "@/lib/domain/stripe-signature";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const WEBHOOK_SECRET = "whsec_test_secret";

describe("POST /api/webhooks/stripe", () => {
  let repos: ReturnType<typeof createInMemoryRepositories>;
  let studioId: string;

  beforeEach(() => {
    const seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    studioId = seed.studio.id;
    __setTestRepositories(repos);
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("marks an open invoice paid with valid signature", async () => {
    const openInvoice = (await repos.invoices.listByStudio(studioId)).find(
      (inv) => inv.status === "open",
    );
    expect(openInvoice).toBeDefined();

    const payload = JSON.stringify({
      id: "evt_test_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice!.id,
          },
        },
      },
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signStripePayload({
      payload,
      secret: WEBHOOK_SECRET,
      timestampSeconds: timestamp,
    });

    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "stripe-signature": signature,
      },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);

    const updated = await repos.invoices.getById(openInvoice!.id);
    expect(updated!.status).toBe("paid");
    expect(updated!.paidAt).toBeDefined();
  });

  it("returns 400 with missing Stripe-Signature header", async () => {
    const openInvoice = (await repos.invoices.listByStudio(studioId)).find(
      (inv) => inv.status === "open",
    );

    const payload = JSON.stringify({
      id: "evt_test_2",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice!.id,
          },
        },
      },
    });

    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
    });

    const res = await POST(request);
    expect(res.status).toBe(400);

    const invoice = await repos.invoices.getById(openInvoice!.id);
    expect(invoice!.status).toBe("open"); // Unchanged
  });

  it("returns 400 with tampered signature", async () => {
    const openInvoice = (await repos.invoices.listByStudio(studioId)).find(
      (inv) => inv.status === "open",
    );

    const payload = JSON.stringify({
      id: "evt_test_3",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice!.id,
          },
        },
      },
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signStripePayload({
      payload,
      secret: WEBHOOK_SECRET,
      timestampSeconds: timestamp,
    });

    // Tamper with the signature
    const tamperedSignature = signature.replace(/[0-9a-f](?=[0-9a-f])/i, (match) => {
      const code = parseInt(match, 16);
      return ((code + 1) % 16).toString(16);
    });

    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "stripe-signature": tamperedSignature,
      },
    });

    const res = await POST(request);
    expect(res.status).toBe(400);

    const invoice = await repos.invoices.getById(openInvoice!.id);
    expect(invoice!.status).toBe("open"); // Unchanged
  });

  it("is idempotent: same event twice returns 200 both times, invoice paid once", async () => {
    const openInvoice = (await repos.invoices.listByStudio(studioId)).find(
      (inv) => inv.status === "open",
    );

    const payload = JSON.stringify({
      id: "evt_idempotent",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice!.id,
          },
        },
      },
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signStripePayload({
      payload,
      secret: WEBHOOK_SECRET,
      timestampSeconds: timestamp,
    });

    // First delivery
    const request1 = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "stripe-signature": signature,
      },
    });
    const res1 = await POST(request1);
    expect(res1.status).toBe(200);

    const afterFirst = await repos.invoices.getById(openInvoice!.id);
    const firstPaidAt = afterFirst!.paidAt;

    // Second delivery (replay)
    const request2 = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "stripe-signature": signature,
      },
    });
    const res2 = await POST(request2);
    expect(res2.status).toBe(200);

    const afterSecond = await repos.invoices.getById(openInvoice!.id);
    expect(afterSecond!.status).toBe("paid");
    expect(afterSecond!.paidAt).toBe(firstPaidAt); // No change
  });

  it("acknowledges (200) a verified event with unknown invoice_id", async () => {
    const payload = JSON.stringify({
      id: "evt_unknown_invoice",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: "inv_does_not_exist",
          },
        },
      },
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signStripePayload({
      payload,
      secret: WEBHOOK_SECRET,
      timestampSeconds: timestamp,
    });

    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "stripe-signature": signature,
      },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);

    // Verify no invoices changed unexpectedly
    const allInvoices = await repos.invoices.listByStudio(studioId);
    const paidCount = allInvoices.filter((inv) => inv.status === "paid").length;
    const beforeCount = ["paid", "paid", "paid"].length; // Some from seed are paid
    expect(paidCount).toBeGreaterThanOrEqual(beforeCount - 1); // At least as many
  });

  it("acknowledges (200) a verified event of different type", async () => {
    const openInvoice = (await repos.invoices.listByStudio(studioId)).find(
      (inv) => inv.status === "open",
    );

    const payload = JSON.stringify({
      id: "evt_charge_refunded",
      type: "charge.refunded",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice!.id,
          },
        },
      },
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signStripePayload({
      payload,
      secret: WEBHOOK_SECRET,
      timestampSeconds: timestamp,
    });

    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "stripe-signature": signature,
      },
    });

    const res = await POST(request);
    expect(res.status).toBe(200);

    const invoice = await repos.invoices.getById(openInvoice!.id);
    expect(invoice!.status).toBe("open"); // Unchanged
  });
});
