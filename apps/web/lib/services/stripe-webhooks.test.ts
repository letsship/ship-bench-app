import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { StripeEvent } from "@/lib/domain/stripe-webhook";
import { handleStripeEvent } from "./stripe-webhooks";

describe("handleStripeEvent", () => {
  let repos: ReturnType<typeof createInMemoryRepositories>;
  let studioId: string;

  beforeEach(() => {
    const seed = buildSeed();
    repos = createInMemoryRepositories(seed);
    __setTestRepositories(repos);
    studioId = seed.studio.id;
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("marks an open invoice as paid when receiving invoice.paid event", async () => {
    const invoices = await repos.invoices.listByStudio(studioId);
    const openInvoice = invoices.find((inv) => inv.status === "open");
    if (!openInvoice) throw new Error("No open invoice in seed data");

    const event: StripeEvent = {
      id: "evt_test_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice.id,
          },
        },
      },
    };

    const result = await handleStripeEvent(repos, event);

    expect(result.outcome).toBe("paid");

    const updated = await repos.invoices.getById(openInvoice.id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).not.toBeNull();
  });

  it("returns already_paid when replaying the same event on a paid invoice", async () => {
    const invoices = await repos.invoices.listByStudio(studioId);
    const openInvoice = invoices.find((inv) => inv.status === "open");
    if (!openInvoice) throw new Error("No open invoice in seed data");

    const event: StripeEvent = {
      id: "evt_test_456",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice.id,
          },
        },
      },
    };

    const firstResult = await handleStripeEvent(repos, event);
    expect(firstResult.outcome).toBe("paid");

    const updated = await repos.invoices.getById(openInvoice.id);
    const paidAtAfterFirst = updated?.paidAt;

    const secondResult = await handleStripeEvent(repos, event);
    expect(secondResult.outcome).toBe("already_paid");

    const stillUpdated = await repos.invoices.getById(openInvoice.id);
    expect(stillUpdated?.status).toBe("paid");
    expect(stillUpdated?.paidAt).toBe(paidAtAfterFirst);
  });

  it("returns unknown_invoice when invoice_id does not exist", async () => {
    const event: StripeEvent = {
      id: "evt_test_789",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: "nonexistent-invoice-id",
          },
        },
      },
    };

    const result = await handleStripeEvent(repos, event);
    expect(result.outcome).toBe("unknown_invoice");
  });

  it("returns ignored for non-invoice.paid events", async () => {
    const event: StripeEvent = {
      id: "evt_test_other",
      type: "charge.succeeded",
      data: {
        object: {},
      },
    };

    const result = await handleStripeEvent(repos, event);
    expect(result.outcome).toBe("ignored");
  });

  it("returns ignored when metadata.invoice_id is missing", async () => {
    const event: StripeEvent = {
      id: "evt_test_no_metadata",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {},
        },
      },
    };

    const result = await handleStripeEvent(repos, event);
    expect(result.outcome).toBe("ignored");
  });
});
