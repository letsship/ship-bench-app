import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { StripeEvent } from "@/lib/domain/stripe-webhook";
import { handleStripeEvent } from "./stripe-webhooks";

const NOW = new Date();

describe("stripe-webhooks service", () => {
  let repos: Repositories;
  let openInvoiceId: string;

  beforeEach(async () => {
    const seed = buildSeed(NOW);
    const openInvoice = seed.invoices.find((inv) => inv.status === "open");
    if (!openInvoice) throw new Error("No open invoice in seed");
    openInvoiceId = openInvoice.id;
    repos = createInMemoryRepositories(seed);
  });

  it("marks an invoice paid on invoice.paid event", async () => {
    const event: StripeEvent = {
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: openInvoiceId },
        },
      },
    };

    await handleStripeEvent(repos, event);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBeDefined();
  });

  it("is idempotent: replaying the same event leaves invoice paid exactly once", async () => {
    const event: StripeEvent = {
      id: "evt_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: openInvoiceId },
        },
      },
    };

    const beforeFirst = await repos.invoices.getById(openInvoiceId);

    await handleStripeEvent(repos, event);
    const afterFirst = await repos.invoices.getById(openInvoiceId);
    const paidAtAfterFirst = afterFirst?.paidAt;

    await handleStripeEvent(repos, event);
    const afterSecond = await repos.invoices.getById(openInvoiceId);

    expect(beforeFirst?.status).toBe("open");
    expect(afterFirst?.status).toBe("paid");
    expect(afterSecond?.status).toBe("paid");
    expect(afterSecond?.paidAt).toBe(paidAtAfterFirst);
  });

  it("ignores event with unknown invoice id", async () => {
    const event: StripeEvent = {
      id: "evt_456",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { invoice_id: "unknown_invoice_id" },
        },
      },
    };

    await handleStripeEvent(repos, event);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });

  it("ignores non-invoice.paid event", async () => {
    const event: StripeEvent = {
      id: "evt_789",
      type: "charge.succeeded",
      data: {
        object: {
          metadata: { invoice_id: openInvoiceId },
        },
      },
    };

    await handleStripeEvent(repos, event);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });

  it("ignores invoice.paid event without metadata", async () => {
    const event: StripeEvent = {
      id: "evt_999",
      type: "invoice.paid",
      data: {
        object: {},
      },
    };

    await handleStripeEvent(repos, event);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });
});
