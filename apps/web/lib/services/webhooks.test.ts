import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { handleStripeEvent } from "./webhooks";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function stripeEvent(id: string, type: string, invoiceId: string | undefined) {
  return {
    id,
    type,
    data: {
      object: {
        metadata: invoiceId === undefined ? {} : { invoice_id: invoiceId },
      },
    },
  };
}

describe("handleStripeEvent", () => {
  let repos: Repositories;
  let openInvoiceId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = await repos.studios.getFirst();
    if (!studio) throw new Error("expected a seeded studio");
    const invoices = await repos.invoices.listByStudio(studio.id);
    const open = invoices.find((invoice) => invoice.status === "open");
    if (!open) throw new Error("expected a seeded open invoice");
    openInvoiceId = open.id;
  });

  it("marks the named invoice paid on invoice.paid", async () => {
    await handleStripeEvent(repos, stripeEvent("evt_1", "invoice.paid", openInvoiceId));
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).not.toBeNull();
  });

  it("is idempotent: replaying the same event leaves it paid once", async () => {
    await handleStripeEvent(repos, stripeEvent("evt_1", "invoice.paid", openInvoiceId));
    const firstPaidAt = (await repos.invoices.getById(openInvoiceId))?.paidAt;
    await handleStripeEvent(repos, stripeEvent("evt_1", "invoice.paid", openInvoiceId));
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(firstPaidAt);
  });

  it("acknowledges but changes nothing for an unknown invoice id", async () => {
    await handleStripeEvent(repos, stripeEvent("evt_2", "invoice.paid", "does-not-exist"));
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });

  it("acknowledges but changes nothing for a different event type", async () => {
    await handleStripeEvent(repos, stripeEvent("evt_3", "invoice.voided", openInvoiceId));
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });
});
