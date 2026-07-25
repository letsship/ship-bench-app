import { beforeEach, describe, expect, it } from "vitest";
import type { Repositories } from "@/lib/db/repos/types";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { StripeWebhookEvent } from "@/lib/validation";
import { handleStripeEvent } from "./stripe-webhooks";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("handleStripeEvent", () => {
  let repos: Repositories;
  let studioId: string;

  beforeEach(() => {
    const seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    studioId = seed.studio.id;
    __setTestRepositories(repos);
  });

  it("marks an open invoice paid when receiving invoice.paid event", async () => {
    // Get the open invoice from the seed
    const openInvoice = (await repos.invoices.listByStudio(studioId)).find(
      (inv) => inv.status === "open",
    );
    expect(openInvoice).toBeDefined();

    const event: StripeWebhookEvent = {
      id: "evt_test_123",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice!.id,
          },
        },
      },
    };

    const result = await handleStripeEvent(repos, event);
    expect(result.outcome).toBe("paid");

    const updated = await repos.invoices.getById(openInvoice!.id);
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("paid");
    expect(updated!.paidAt).toBeDefined();
    expect(updated!.paidAt).not.toBeNull();
  });

  it("is idempotent: receiving the same event twice leaves exactly one paidAt", async () => {
    const openInvoice = (await repos.invoices.listByStudio(studioId)).find(
      (inv) => inv.status === "open",
    );
    expect(openInvoice).toBeDefined();

    const event: StripeWebhookEvent = {
      id: "evt_idempotent_456",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice!.id,
          },
        },
      },
    };

    // First delivery
    const result1 = await handleStripeEvent(repos, event);
    expect(result1.outcome).toBe("paid");
    const firstUpdate = await repos.invoices.getById(openInvoice!.id);
    expect(firstUpdate!.status).toBe("paid");
    const firstPaidAt = firstUpdate!.paidAt;

    // Second delivery (replay)
    const result2 = await handleStripeEvent(repos, event);
    expect(result2.outcome).toBe("already_paid");
    const secondUpdate = await repos.invoices.getById(openInvoice!.id);
    expect(secondUpdate!.status).toBe("paid");
    expect(secondUpdate!.paidAt).toBe(firstPaidAt); // No change
  });

  it("returns unknown_invoice for non-existent invoice", async () => {
    const event: StripeWebhookEvent = {
      id: "evt_unknown_789",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {
            invoice_id: "inv_does_not_exist",
          },
        },
      },
    };

    const result = await handleStripeEvent(repos, event);
    expect(result.outcome).toBe("unknown_invoice");

    // Verify no invoices changed
    const allInvoices = await repos.invoices.listByStudio(studioId);
    const paidCount = allInvoices.filter((inv) => inv.status === "paid").length;
    expect(paidCount).toBeGreaterThan(0); // Some should already be paid from seed
  });

  it("returns ignored_type for non-invoice.paid events", async () => {
    const openInvoice = (await repos.invoices.listByStudio(studioId)).find(
      (inv) => inv.status === "open",
    );

    const event: StripeWebhookEvent = {
      id: "evt_charge_999",
      type: "charge.refunded",
      data: {
        object: {
          metadata: {
            invoice_id: openInvoice!.id,
          },
        },
      },
    };

    const result = await handleStripeEvent(repos, event);
    expect(result.outcome).toBe("ignored_type");

    // Verify the invoice status didn't change
    const invoice = await repos.invoices.getById(openInvoice!.id);
    expect(invoice!.status).toBe("open");
  });

  it("returns unknown_invoice when metadata.invoice_id is missing", async () => {
    const event: StripeWebhookEvent = {
      id: "evt_no_metadata",
      type: "invoice.paid",
      data: {
        object: {
          metadata: {},
        },
      },
    };

    const result = await handleStripeEvent(repos, event);
    expect(result.outcome).toBe("unknown_invoice");
  });
});
