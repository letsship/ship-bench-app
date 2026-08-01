import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { StripeEvent } from "@/lib/validation";
import { handleStripeEvent } from "./webhooks";

const NOW = new Date("2026-08-01T12:00:00.000Z");

function stripeEvent(type: string, invoiceId?: string): StripeEvent {
  return {
    id: "evt_test",
    type,
    data: {
      object: invoiceId ? { metadata: { invoice_id: invoiceId } } : {},
    },
  };
}

describe("handleStripeEvent", () => {
  let repos: Repositories;
  let openInvoiceId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = await repos.studios.getFirst();
    const invoices = await repos.invoices.listByStudio(studio?.id ?? "");
    openInvoiceId = invoices.find((invoice) => invoice.status === "open")?.id ?? "";
  });

  it("marks the referenced open invoice paid", async () => {
    await handleStripeEvent(repos, stripeEvent("invoice.paid", openInvoiceId));

    const invoice = await repos.invoices.getById(openInvoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).not.toBeNull();
  });

  it("does not update an invoice twice for a re-delivered event", async () => {
    const update = vi.spyOn(repos.invoices, "update");
    const event = stripeEvent("invoice.paid", openInvoiceId);

    await handleStripeEvent(repos, event);
    const firstPaidAt = (await repos.invoices.getById(openInvoiceId))?.paidAt;
    await handleStripeEvent(repos, event);

    expect(update).toHaveBeenCalledTimes(1);
    expect((await repos.invoices.getById(openInvoiceId))?.paidAt).toBe(firstPaidAt);
  });

  it("acknowledges an unknown invoice without changing invoices", async () => {
    const update = vi.spyOn(repos.invoices, "update");
    await handleStripeEvent(repos, stripeEvent("invoice.paid", "missing-invoice"));
    expect(update).not.toHaveBeenCalled();
  });

  it("acknowledges another event type without changing invoices", async () => {
    const update = vi.spyOn(repos.invoices, "update");
    await handleStripeEvent(repos, stripeEvent("invoice.created", openInvoiceId));
    expect(update).not.toHaveBeenCalled();
  });
});
