import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Invoice } from "@/lib/db/types";
import type { StripeWebhookEvent } from "@/lib/validation";
import { processStripeWebhookEvent } from "./stripe-webhooks";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function invoicePaidEvent(id: string, invoiceId?: string): StripeWebhookEvent {
  return {
    id,
    type: "invoice.paid",
    data: { object: { metadata: invoiceId ? { invoice_id: invoiceId } : {} } },
  };
}

async function listInvoices(repos: Repositories): Promise<Invoice[]> {
  const studio = await repos.studios.getFirst();
  if (!studio) throw new Error("Seed studio missing");
  return repos.invoices.listByStudio(studio.id);
}

async function findByStatus(repos: Repositories, status: string): Promise<Invoice> {
  const invoice = (await listInvoices(repos)).find((row) => row.status === status);
  if (!invoice) throw new Error(`Expected a seeded ${status} invoice`);
  return invoice;
}

describe("processStripeWebhookEvent", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
  });

  it("marks the referenced open invoice paid and sets paidAt", async () => {
    const open = await findByStatus(repos, "open");
    await processStripeWebhookEvent(repos, invoicePaidEvent("evt_1", open.id));
    const updated = await repos.invoices.getById(open.id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).not.toBeNull();
  });

  it("is idempotent: replaying the same event id changes nothing further", async () => {
    const open = await findByStatus(repos, "open");
    const event = invoicePaidEvent("evt_replay", open.id);
    await processStripeWebhookEvent(repos, event);
    const afterFirst = await repos.invoices.getById(open.id);
    await processStripeWebhookEvent(repos, event);
    const afterSecond = await repos.invoices.getById(open.id);
    expect(afterSecond?.status).toBe("paid");
    expect(afterSecond?.paidAt).toBe(afterFirst?.paidAt);
  });

  it("does not re-mark an invoice that is already paid", async () => {
    const paid = await findByStatus(repos, "paid");
    await processStripeWebhookEvent(repos, invoicePaidEvent("evt_paid_again", paid.id));
    const after = await repos.invoices.getById(paid.id);
    expect(after?.paidAt).toBe(paid.paidAt);
  });

  it("acknowledges an unknown invoice without changing anything", async () => {
    const before = await listInvoices(repos);
    await processStripeWebhookEvent(repos, invoicePaidEvent("evt_unknown", "missing-invoice-id"));
    expect(await listInvoices(repos)).toEqual(before);
  });

  it("ignores an invoice.paid event without an invoice_id in metadata", async () => {
    const before = await listInvoices(repos);
    await processStripeWebhookEvent(repos, invoicePaidEvent("evt_no_metadata"));
    expect(await listInvoices(repos)).toEqual(before);
  });

  it("ignores events of other types", async () => {
    const open = await findByStatus(repos, "open");
    const before = await listInvoices(repos);
    await processStripeWebhookEvent(repos, {
      id: "evt_other",
      type: "customer.created",
      data: { object: { metadata: { invoice_id: open.id } } },
    });
    expect(await listInvoices(repos)).toEqual(before);
  });

  it("records each processed event id exactly once", async () => {
    const open = await findByStatus(repos, "open");
    const event = invoicePaidEvent("evt_ledger", open.id);
    await processStripeWebhookEvent(repos, event);
    await processStripeWebhookEvent(repos, event);
    const recorded = await repos.webhookEvents.getById("evt_ledger");
    expect(recorded?.type).toBe("invoice.paid");
  });
});
