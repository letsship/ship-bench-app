import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { type StripeEvent, applyStripeEvent } from "./stripe-webhooks";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function invoicePaidEvent(invoiceId: string, id = "evt_1"): StripeEvent {
  return {
    id,
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  };
}

describe("applyStripeEvent", () => {
  let repos: Repositories;
  let openInvoiceId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = await repos.studios.getFirst();
    const invoices = await repos.invoices.listByStudio(studio!.id);
    const open = invoices.find((invoice) => invoice.status === "open");
    if (!open) throw new Error("seed has no open invoice");
    openInvoiceId = open.id;
  });

  it("marks a seeded open invoice paid", async () => {
    const result = await applyStripeEvent(repos, invoicePaidEvent(openInvoiceId), NOW);
    expect(result).toBe("marked");
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(NOW.toISOString());
  });

  it("is idempotent: a redelivered event leaves the invoice paid exactly once", async () => {
    await applyStripeEvent(repos, invoicePaidEvent(openInvoiceId), NOW);
    const later = new Date(NOW.getTime() + 60_000);
    const result = await applyStripeEvent(repos, invoicePaidEvent(openInvoiceId), later);

    expect(result).toBe("already-paid");
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(NOW.toISOString());
  });

  it("changes nothing for an unknown invoice id", async () => {
    const result = await applyStripeEvent(repos, invoicePaidEvent("nonexistent-id"), NOW);
    expect(result).toBe("unknown-invoice");
  });

  it("changes nothing for a non-invoice.paid event", async () => {
    const event: StripeEvent = {
      id: "evt_2",
      type: "invoice.voided",
      data: { object: { metadata: { invoice_id: openInvoiceId } } },
    };
    const result = await applyStripeEvent(repos, event, NOW);
    expect(result).toBe("ignored");
    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("open");
  });
});
