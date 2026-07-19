import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { StripeEvent } from "@/lib/domain/stripe";
import { processStripeEvent } from "./stripe-webhooks";

const NOW = new Date();
const ISO = NOW.toISOString();

describe("processStripeEvent", () => {
  it("marks an open invoice as paid when receiving invoice.paid", async () => {
    const seed = buildSeed(NOW);
    // Seed has invoices; grab one and mark it open for testing.
    if (seed.invoices.length > 0) {
      seed.invoices[0].status = "open";
      seed.invoices[0].paidAt = null;
    }

    const repos = createInMemoryRepositories(seed);
    const invoiceId = seed.invoices[0]?.id ?? "inv_1";

    const event: StripeEvent = {
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: invoiceId },
        },
      },
    };

    await processStripeEvent(repos, event);

    const updated = await repos.invoices.getById(invoiceId);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).toBeTruthy();
  });

  it("idempotently marks an already-paid invoice with no error", async () => {
    const seed = buildSeed(NOW);
    if (seed.invoices.length > 0) {
      seed.invoices[0].status = "paid";
      seed.invoices[0].paidAt = ISO;
    }

    const repos = createInMemoryRepositories(seed);
    const invoiceId = seed.invoices[0]?.id ?? "inv_1";

    const event: StripeEvent = {
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: invoiceId },
        },
      },
    };

    await processStripeEvent(repos, event);

    const invoice = await repos.invoices.getById(invoiceId);
    expect(invoice?.status).toBe("paid");
    // paidAt should not be updated (or should be the same since we re-sent the event)
    expect(invoice?.paidAt).toBeTruthy();
  });

  it("ignores an invoice.paid event for an unknown invoice", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));

    const event: StripeEvent = {
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: "unknown_invoice_id" },
        },
      },
    };

    // Should not throw; just acknowledge.
    await processStripeEvent(repos, event);
  });

  it("ignores an invoice.paid event with missing invoice_id metadata", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));

    const event: StripeEvent = {
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: undefined,
        },
      },
    };

    await processStripeEvent(repos, event);
  });

  it("ignores a non-invoice.paid event", async () => {
    const seed = buildSeed(NOW);
    if (seed.invoices.length > 0) {
      seed.invoices[0].status = "open";
      seed.invoices[0].paidAt = null;
    }

    const repos = createInMemoryRepositories(seed);
    const invoiceId = seed.invoices[0]?.id ?? "inv_1";

    const event: StripeEvent = {
      id: "evt_456",
      type: "charge.succeeded", // Different type
      data: {
        object: {
          metadata: { invoice_id: invoiceId },
        },
      },
    };

    await processStripeEvent(repos, event);

    const invoice = await repos.invoices.getById(invoiceId);
    // Should still be open, unchanged.
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });
});
