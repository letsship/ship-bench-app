import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice } from "@/lib/db/types";
import { processStripeEvent } from "./stripe-webhooks";
import type { StripeEvent } from "@/lib/validation";

const NOW = new Date("2026-03-15T12:00:00.000Z").toISOString();

function invoice(id: string, over: Partial<Invoice> = {}): Invoice {
  return {
    id,
    studioId: "s1",
    memberId: "m1",
    number: `INV-2026-${id}`,
    status: "open",
    currency: "EUR",
    taxRateBps: 0,
    subtotalCents: 1000,
    taxCents: 0,
    totalCents: 1000,
    issuedAt: NOW,
    dueAt: null,
    paidAt: null,
    createdAt: NOW,
    ...over,
  };
}

function baseSeed(invoices: Invoice[]): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: NOW },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: 0,
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

function paidEvent(invoiceId: string, id = "evt_1"): StripeEvent {
  return {
    id,
    type: "invoice.paid",
    data: { object: { metadata: { invoice_id: invoiceId } } },
  };
}

describe("processStripeEvent", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(baseSeed([invoice("inv_1")]));
  });

  it("marks a verified invoice.paid event as paid with paidAt set", async () => {
    const outcome = await processStripeEvent(repos, paidEvent("inv_1"));
    expect(outcome).toBe("marked-paid");
    const updated = await repos.invoices.getById("inv_1");
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).not.toBeNull();
  });

  it("is idempotent: the same event delivered twice leaves it paid once", async () => {
    const first = await processStripeEvent(repos, paidEvent("inv_1", "evt_same"));
    expect(first).toBe("marked-paid");
    const afterFirst = await repos.invoices.getById("inv_1");
    const paidAt = afterFirst?.paidAt;

    const second = await processStripeEvent(repos, paidEvent("inv_1", "evt_same"));
    expect(second).toBe("already-paid");
    const afterSecond = await repos.invoices.getById("inv_1");
    expect(afterSecond?.status).toBe("paid");
    expect(afterSecond?.paidAt).toBe(paidAt);
  });

  it("acknowledges an event naming an unknown invoice and changes nothing", async () => {
    const outcome = await processStripeEvent(repos, paidEvent("inv_missing"));
    expect(outcome).toBe("unknown-invoice");
    const untouched = await repos.invoices.getById("inv_1");
    expect(untouched?.status).toBe("open");
    expect(untouched?.paidAt).toBeNull();
  });

  it("acknowledges a non-invoice.paid event and changes nothing", async () => {
    const outcome = await processStripeEvent(repos, {
      id: "evt_other",
      type: "invoice.payment_failed",
      data: { object: { metadata: { invoice_id: "inv_1" } } },
    });
    expect(outcome).toBe("ignored");
    const untouched = await repos.invoices.getById("inv_1");
    expect(untouched?.status).toBe("open");
    expect(untouched?.paidAt).toBeNull();
  });
});
