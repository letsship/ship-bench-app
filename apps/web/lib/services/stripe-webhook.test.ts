import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Invoice } from "@/lib/db/types";
import { handleStripeEvent, type StripeWebhookEvent } from "./stripe-webhook";

const NOW = new Date("2026-07-01T12:00:00.000Z");

// Helper: find the first open (unpaid) invoice in the seed.
async function findOpenInvoice(repos: Repositories): Promise<Invoice> {
  const studio = (await repos.studios.getFirst())!;
  const invoices = await repos.invoices.listByStudio(studio.id);
  const open = invoices.find((inv) => inv.status === "open");
  expect(open).toBeDefined();
  return open!;
}

function makeInvoicePaidEvent(invoiceId: string): StripeWebhookEvent {
  return {
    id: "evt_test_paid_001",
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  };
}

function makeOtherEvent(): StripeWebhookEvent {
  return {
    id: "evt_test_other_001",
    type: "payment_intent.succeeded",
    data: { object: { metadata: {} } },
  };
}

function makeInvoicePaidEventNoMetadata(): StripeWebhookEvent {
  return {
    id: "evt_test_paid_002",
    type: "invoice.paid",
    data: { object: { metadata: {} } },
  };
}

describe("handleStripeEvent", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
  });

  it("marks an open invoice as paid", async () => {
    const invoice = await findOpenInvoice(repos);
    expect(invoice.status).toBe("open");
    expect(invoice.paidAt).toBeNull();

    await handleStripeEvent(repos, makeInvoicePaidEvent(invoice.id));

    const updated = await repos.invoices.getById(invoice.id);
    expect(updated!.status).toBe("paid");
    expect(updated!.paidAt).not.toBeNull();
  });

  it("is idempotent when the same event arrives twice", async () => {
    const invoice = await findOpenInvoice(repos);

    // First call
    await handleStripeEvent(repos, makeInvoicePaidEvent(invoice.id));
    const afterFirst = await repos.invoices.getById(invoice.id);
    expect(afterFirst!.status).toBe("paid");
    const firstPaidAt = afterFirst!.paidAt;

    // Second call — same event id (same invoice)
    await handleStripeEvent(repos, makeInvoicePaidEvent(invoice.id));
    const afterSecond = await repos.invoices.getById(invoice.id);
    expect(afterSecond!.status).toBe("paid");
    // paidAt should be unchanged (idempotent)
    expect(afterSecond!.paidAt).toBe(firstPaidAt);
  });

  it("does nothing for an unknown invoice", async () => {
    // No throw, no change
    await expect(
      handleStripeEvent(repos, makeInvoicePaidEvent("non_existent_invoice")),
    ).resolves.toBeUndefined();

    // Verify the database hasn't changed (still one paid invoice from seed)
    const studio = (await repos.studios.getFirst())!;
    const all = await repos.invoices.listByStudio(studio.id);
    const paidCount = all.filter((inv) => inv.status === "paid").length;
    expect(paidCount).toBeGreaterThan(0);
  });

  it("does nothing for a non-invoice.paid event", async () => {
    // Should not throw
    await expect(handleStripeEvent(repos, makeOtherEvent())).resolves.toBeUndefined();
  });

  it("does nothing for an invoice.paid event without invoice_id metadata", async () => {
    await expect(
      handleStripeEvent(repos, makeInvoicePaidEventNoMetadata()),
    ).resolves.toBeUndefined();
  });

  it("does not throw when the invoice is already paid", async () => {
    // Find a seed invoice that is already paid
    const studio = (await repos.studios.getFirst())!;
    const allInvoices = await repos.invoices.listByStudio(studio.id);
    const paidSeed = allInvoices.find((inv) => inv.status === "paid");
    expect(paidSeed).toBeDefined();

    await expect(
      handleStripeEvent(repos, makeInvoicePaidEvent(paidSeed!.id)),
    ).resolves.toBeUndefined();

    // Status unchanged
    const after = await repos.invoices.getById(paidSeed!.id);
    expect(after!.status).toBe("paid");
  });
});