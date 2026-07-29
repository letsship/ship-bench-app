import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { StripeEvent } from "@/lib/validation";
import { handleStripeInvoiceWebhook } from "./webhooks";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function invoicePaidEvent(invoiceId: string, eventId = "evt_1"): StripeEvent {
  return {
    id: eventId,
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  };
}

describe("handleStripeInvoiceWebhook", () => {
  let repos: Repositories;
  let openInvoiceId: string;

  beforeEach(() => {
    const seed = buildSeed(NOW);
    const open = seed.invoices.find((invoice) => invoice.status === "open");
    if (!open) throw new Error("seed must contain an open invoice");
    openInvoiceId = open.id;
    repos = createInMemoryRepositories(seed);
  });

  it("marks the named invoice paid and sets paidAt", async () => {
    const result = await handleStripeInvoiceWebhook(repos, invoicePaidEvent(openInvoiceId));
    expect(result).toEqual({ handled: true });
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).not.toBeNull();
  });

  it("replaying the same event leaves it paid once and keeps the original paidAt", async () => {
    await handleStripeInvoiceWebhook(repos, invoicePaidEvent(openInvoiceId));
    const first = await repos.invoices.getById(openInvoiceId);

    const replay = await handleStripeInvoiceWebhook(repos, invoicePaidEvent(openInvoiceId));
    expect(replay).toEqual({ handled: false });

    const after = await repos.invoices.getById(openInvoiceId);
    expect(after?.status).toBe("paid");
    expect(after?.paidAt).toBe(first?.paidAt);
  });

  it("acknowledges an unknown invoice without changing anything", async () => {
    const result = await handleStripeInvoiceWebhook(repos, invoicePaidEvent("inv_missing"));
    expect(result).toEqual({ handled: false });
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });

  it("ignores events of any other type", async () => {
    const result = await handleStripeInvoiceWebhook(repos, {
      id: "evt_2",
      type: "customer.created",
      data: { object: { metadata: { invoice_id: openInvoiceId } } },
    });
    expect(result).toEqual({ handled: false });
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });

  it("acknowledges an invoice.paid event without invoice metadata", async () => {
    const result = await handleStripeInvoiceWebhook(repos, {
      id: "evt_3",
      type: "invoice.paid",
      data: { object: {} },
    });
    expect(result).toEqual({ handled: false });
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });
});
