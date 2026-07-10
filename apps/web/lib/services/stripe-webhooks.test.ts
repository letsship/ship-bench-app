import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice } from "@/lib/db/types";
import type { StripeWebhookEventInput } from "@/lib/validation";
import { processStripeWebhookEvent } from "./stripe-webhooks";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const ISO = NOW.toISOString();

const invoice: Invoice = {
  id: "inv_1",
  studioId: "s1",
  memberId: "mem_1",
  number: "INV-2026-0001",
  status: "open",
  currency: "EUR",
  taxRateBps: 0,
  subtotalCents: 1000,
  taxCents: 0,
  totalCents: 1000,
  issuedAt: ISO,
  dueAt: null,
  paidAt: null,
  createdAt: ISO,
};

function invoicePaidEvent(over: Partial<StripeWebhookEventInput> = {}): StripeWebhookEventInput {
  return {
    id: "evt_1",
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoice.id } } },
    ...over,
  };
}

describe("processStripeWebhookEvent", () => {
  let repos: Repositories;

  beforeEach(async () => {
    repos = createInMemoryRepositories();
    await repos.invoices.insert(invoice);
  });

  it("marks the matching invoice paid on a verified invoice.paid event", async () => {
    await processStripeWebhookEvent(repos, invoicePaidEvent());
    const updated = await repos.invoices.getById(invoice.id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).not.toBeNull();
  });

  it("is idempotent: replaying the same event id leaves the invoice paid exactly once", async () => {
    await processStripeWebhookEvent(repos, invoicePaidEvent());
    const firstPaidAt = (await repos.invoices.getById(invoice.id))?.paidAt;

    await expect(processStripeWebhookEvent(repos, invoicePaidEvent())).resolves.not.toThrow();

    const updated = await repos.invoices.getById(invoice.id);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).toBe(firstPaidAt);
  });

  it("changes nothing for an invoice.paid event naming an unknown invoice", async () => {
    await processStripeWebhookEvent(
      repos,
      invoicePaidEvent({ id: "evt_2", data: { object: { metadata: { invoice_id: "unknown" } } } }),
    );
    const unchanged = await repos.invoices.getById(invoice.id);
    expect(unchanged?.status).toBe("open");
  });

  it("changes nothing for an event of another type", async () => {
    await processStripeWebhookEvent(
      repos,
      invoicePaidEvent({ id: "evt_3", type: "payment_intent.succeeded" }),
    );
    const unchanged = await repos.invoices.getById(invoice.id);
    expect(unchanged?.status).toBe("open");
  });
});
