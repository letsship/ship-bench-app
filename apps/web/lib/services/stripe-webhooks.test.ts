import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice } from "@/lib/db/types";
import type { StripeWebhookEvent } from "@/lib/validation";
import { processStripeWebhookEvent } from "./stripe-webhooks";

const NOW = new Date("2026-03-15T12:00:00.000Z");
const ISO = NOW.toISOString();

function baseSeed(invoices: Invoice[]): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: 900,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices,
    lineItems: [],
    outbox: [],
  };
}

const invoice = (id: string, status: string): Invoice => ({
  id,
  studioId: "s1",
  memberId: "m1",
  number: "INV-2026-0001",
  status,
  currency: "EUR",
  taxRateBps: 900,
  subtotalCents: 1000,
  taxCents: 90,
  totalCents: 1090,
  issuedAt: ISO,
  dueAt: null,
  paidAt: null,
  createdAt: ISO,
});

function invoicePaidEvent(id: string, invoiceId: string): StripeWebhookEvent {
  return {
    id,
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  };
}

describe("processStripeWebhookEvent", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(baseSeed([invoice("inv_1", "open")]));
  });

  it("marks a known open invoice paid on invoice.paid", async () => {
    const result = await processStripeWebhookEvent(repos, invoicePaidEvent("evt_1", "inv_1"));
    expect(result).toEqual({ handled: true, invoiceId: "inv_1" });

    const updated = await repos.invoices.getById("inv_1");
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).not.toBeNull();
  });

  it("is idempotent: replaying the same event id leaves the invoice paid exactly once", async () => {
    await processStripeWebhookEvent(repos, invoicePaidEvent("evt_1", "inv_1"));
    const firstPaidAt = (await repos.invoices.getById("inv_1"))?.paidAt;

    const secondResult = await processStripeWebhookEvent(repos, invoicePaidEvent("evt_1", "inv_1"));
    expect(secondResult).toEqual({ handled: false, invoiceId: null });

    const updated = await repos.invoices.getById("inv_1");
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).toBe(firstPaidAt);
  });

  it("changes nothing for an unknown invoice id", async () => {
    const result = await processStripeWebhookEvent(repos, invoicePaidEvent("evt_2", "inv_missing"));
    expect(result).toEqual({ handled: false, invoiceId: null });
    expect(await repos.invoices.getById("inv_1")).toMatchObject({ status: "open" });
  });

  it("changes nothing for a verified event of another type", async () => {
    const result = await processStripeWebhookEvent(repos, {
      id: "evt_3",
      type: "customer.created",
      data: { object: {} },
    });
    expect(result).toEqual({ handled: false, invoiceId: null });
    expect(await repos.invoices.getById("inv_1")).toMatchObject({ status: "open" });
  });
});
