import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { processStripeEvent } from "./webhooks";
import type { StripeEvent } from "@/lib/validation";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("processStripeEvent", () => {
  it("marks an open invoice as paid and sets paidAt", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const invoices = await repos.invoices.listByStudio((await repos.studios.getFirst())!.id);
    const openInvoice = invoices.find((inv) => inv.status === "open");

    if (!openInvoice) {
      throw new Error("No open invoice found in seed data");
    }

    const event: StripeEvent = {
      id: "evt_test_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice.id,
          },
        },
      },
    };

    const result = await processStripeEvent(repos, event);

    expect(result).toBe("marked_paid");
    const updated = await repos.invoices.getById(openInvoice.id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).not.toBeNull();
  });

  it("returns already_paid when invoice is already paid (idempotency)", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = (await repos.studios.getFirst())!;
    const invoices = await repos.invoices.listByStudio(studio.id);
    const openInvoice = invoices.find((inv) => inv.status === "open");

    if (!openInvoice) {
      throw new Error("No open invoice found in seed data");
    }

    // First, mark it paid
    const firstEvent: StripeEvent = {
      id: "evt_test_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice.id,
          },
        },
      },
    };

    const firstResult = await processStripeEvent(repos, firstEvent);
    expect(firstResult).toBe("marked_paid");

    const paidAtAfterFirst = (await repos.invoices.getById(openInvoice.id))?.paidAt;

    // Now send the same event again (redelivery)
    const secondResult = await processStripeEvent(repos, firstEvent);
    expect(secondResult).toBe("already_paid");

    // Verify paidAt hasn't changed
    const paidAtAfterSecond = (await repos.invoices.getById(openInvoice.id))?.paidAt;
    expect(paidAtAfterSecond).toBe(paidAtAfterFirst);
  });

  it("returns unknown_invoice when invoice_id is missing", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));

    const event: StripeEvent = {
      id: "evt_test_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {},
        },
      },
    };

    const result = await processStripeEvent(repos, event);

    expect(result).toBe("unknown_invoice");
  });

  it("returns unknown_invoice when invoice doesn't exist", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));

    const event: StripeEvent = {
      id: "evt_test_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: "nonexistent_id",
          },
        },
      },
    };

    const result = await processStripeEvent(repos, event);

    expect(result).toBe("unknown_invoice");
  });

  it("returns ignored for non-invoice.paid event types", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = (await repos.studios.getFirst())!;
    const invoices = await repos.invoices.listByStudio(studio.id);
    const invoice = invoices[0];

    const event: StripeEvent = {
      id: "evt_test_1",
      type: "invoice.created",
      data: {
        object: {
          metadata: {
            invoice_id: invoice.id,
          },
        },
      },
    };

    const result = await processStripeEvent(repos, event);

    expect(result).toBe("ignored");

    // Verify the invoice is unchanged
    const unchanged = await repos.invoices.getById(invoice.id);
    expect(unchanged?.status).toBe(invoice.status);
  });
});
