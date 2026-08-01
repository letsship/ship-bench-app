import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Repositories } from "@/lib/db/repos/types";
import type { StripeEvent } from "@/lib/webhooks/stripe";
import { handleStripeEvent } from "./webhooks";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function event(id: string, type: string, invoiceId?: string): StripeEvent {
  return {
    id,
    type,
    data: { object: { metadata: invoiceId ? { invoice_id: invoiceId } : {} } },
  };
}

describe("handleStripeEvent", () => {
  let repos: Repositories;
  let invoiceId: string;

  beforeEach(() => {
    const seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    invoiceId = seed.invoices.find((invoice) => invoice.status === "open")?.id ?? "";
  });

  it("marks a paid invoice and records the event", async () => {
    await handleStripeEvent(repos, event("evt_paid", "invoice.paid", invoiceId));

    const invoice = await repos.invoices.getById(invoiceId);
    expect(invoice).toMatchObject({ status: "paid" });
    expect(invoice?.paidAt).not.toBeNull();
    expect(await repos.webhookEvents.getById("evt_paid")).toMatchObject({
      id: "evt_paid",
      type: "invoice.paid",
    });
  });

  it("does not process a duplicate event twice", async () => {
    const stripeEvent = event("evt_duplicate", "invoice.paid", invoiceId);
    await handleStripeEvent(repos, stripeEvent);
    const paidAt = (await repos.invoices.getById(invoiceId))?.paidAt;

    await handleStripeEvent(repos, stripeEvent);

    expect((await repos.invoices.getById(invoiceId))?.paidAt).toBe(paidAt);
    expect(await repos.webhookEvents.getById("evt_duplicate")).not.toBeNull();
  });

  it("acknowledges an event for an unknown invoice", async () => {
    const before = await repos.invoices.getById(invoiceId);
    await handleStripeEvent(repos, event("evt_unknown", "invoice.paid", "inv_missing"));

    expect(await repos.invoices.getById(invoiceId)).toEqual(before);
    expect(await repos.webhookEvents.getById("evt_unknown")).not.toBeNull();
  });

  it("acknowledges other event types without changing invoices", async () => {
    const before = await repos.invoices.getById(invoiceId);
    await handleStripeEvent(repos, event("evt_other", "invoice.created", invoiceId));

    expect(await repos.invoices.getById(invoiceId)).toEqual(before);
    expect(await repos.webhookEvents.getById("evt_other")).not.toBeNull();
  });
});
