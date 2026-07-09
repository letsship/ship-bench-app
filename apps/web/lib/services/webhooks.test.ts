import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { handleStripeEvent } from "./webhooks";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function invoicePaidEvent(id: string, invoiceId: string) {
  return {
    id,
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  };
}

describe("handleStripeEvent", () => {
  let repos: Repositories;
  let openInvoiceId: string;

  beforeEach(async () => {
    const seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    const invoices = await repos.invoices.listByStudio(seed.studio.id);
    const open = invoices.find((invoice) => invoice.status === "open");
    if (!open) throw new Error("expected an open invoice in the seed data");
    openInvoiceId = open.id;
  });

  it("marks an open invoice paid with a paidAt timestamp", async () => {
    const result = await handleStripeEvent(repos, invoicePaidEvent("evt_1", openInvoiceId));
    expect(result.processed).toBe(true);
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBeTruthy();
  });

  it("is idempotent: replaying the same event id processes once", async () => {
    await handleStripeEvent(repos, invoicePaidEvent("evt_1", openInvoiceId));
    const firstPaidAt = (await repos.invoices.getById(openInvoiceId))?.paidAt;

    const result = await handleStripeEvent(repos, invoicePaidEvent("evt_1", openInvoiceId));
    expect(result.processed).toBe(false);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(firstPaidAt);
  });

  it("is a no-op for an unknown invoice id", async () => {
    const result = await handleStripeEvent(repos, invoicePaidEvent("evt_2", "does-not-exist"));
    expect(result.processed).toBe(false);
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });

  it("is a no-op for a non-invoice.paid event type", async () => {
    const event = {
      id: "evt_3",
      type: "invoice.payment_failed",
      data: { object: { metadata: { invoice_id: openInvoiceId } } },
    };
    const result = await handleStripeEvent(repos, event);
    expect(result.processed).toBe(false);
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });
});
