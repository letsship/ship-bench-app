import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { StripeEvent } from "@/lib/domain/stripe-webhook";
import { applyStripeEvent } from "./stripe-webhooks";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("applyStripeEvent", () => {
  let repos: Repositories;
  let openInvoiceId: string;

  beforeEach(async () => {
    const seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    const invoices = await repos.invoices.listByStudio(seed.studio.id);
    const openInvoice = invoices.find((invoice) => invoice.status === "open");
    if (!openInvoice) throw new Error("seed has no open invoice to test against");
    openInvoiceId = openInvoice.id;
  });

  it("marks the named invoice paid with paidAt set", async () => {
    const event: StripeEvent = { id: "evt_1", type: "invoice.paid", invoiceId: openInvoiceId };
    const result = await applyStripeEvent(repos, event);
    expect(result.applied).toBe(true);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).not.toBeNull();
  });

  it("is idempotent: replaying the same event leaves the invoice paid once", async () => {
    const event: StripeEvent = { id: "evt_1", type: "invoice.paid", invoiceId: openInvoiceId };
    await applyStripeEvent(repos, event);
    const firstPaidAt = (await repos.invoices.getById(openInvoiceId))?.paidAt;

    const result = await applyStripeEvent(repos, event);
    expect(result.applied).toBe(false);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(firstPaidAt);
  });

  it("no-ops for an unknown invoice", async () => {
    const event: StripeEvent = {
      id: "evt_2",
      type: "invoice.paid",
      invoiceId: "inv_does_not_exist",
    };
    const result = await applyStripeEvent(repos, event);
    expect(result.applied).toBe(false);
  });

  it("no-ops for a non-invoice.paid event type", async () => {
    const event: StripeEvent = {
      id: "evt_3",
      type: "invoice.payment_failed",
      invoiceId: openInvoiceId,
    };
    const result = await applyStripeEvent(repos, event);
    expect(result.applied).toBe(false);

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });
});
