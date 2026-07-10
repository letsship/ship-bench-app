import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { StripeEventInput } from "@/lib/validation";
import { processStripeWebhookEvent } from "./stripe-webhook";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function invoicePaidEvent(id: string, invoiceId: string): StripeEventInput {
  return {
    id,
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  };
}

describe("processStripeWebhookEvent", () => {
  let repos: Repositories;
  let invoiceId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    const studio = await repos.studios.getFirst();
    const invoices = await repos.invoices.listByStudio(studio?.id ?? "");
    invoiceId = invoices[0].id;
  });

  it("marks the named invoice paid on a verified invoice.paid event", async () => {
    await processStripeWebhookEvent(repos, invoicePaidEvent("evt_1", invoiceId));

    const invoice = await repos.invoices.getById(invoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).not.toBeNull();
  });

  it("is idempotent: replaying the same event id leaves the invoice paid exactly once", async () => {
    await processStripeWebhookEvent(repos, invoicePaidEvent("evt_1", invoiceId));
    const paidAtFirst = (await repos.invoices.getById(invoiceId))?.paidAt;

    await expect(
      processStripeWebhookEvent(repos, invoicePaidEvent("evt_1", invoiceId)),
    ).resolves.not.toThrow();

    const invoice = await repos.invoices.getById(invoiceId);
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(paidAtFirst);
  });

  it("is a no-op for an unknown invoice id", async () => {
    const before = await repos.invoices.getById(invoiceId);

    await expect(
      processStripeWebhookEvent(repos, invoicePaidEvent("evt_2", "unknown-invoice")),
    ).resolves.not.toThrow();

    const after = await repos.invoices.getById(invoiceId);
    expect(after).toEqual(before);
  });

  it("is a no-op for a non-invoice.paid event type", async () => {
    const before = await repos.invoices.getById(invoiceId);

    await processStripeWebhookEvent(repos, {
      id: "evt_3",
      type: "invoice.created",
      data: { object: { metadata: { invoice_id: invoiceId } } },
    });

    const after = await repos.invoices.getById(invoiceId);
    expect(after).toEqual(before);
  });
});
