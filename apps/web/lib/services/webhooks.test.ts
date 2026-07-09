import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { StripeWebhookEventInput } from "@/lib/validation";
import { handleStripeWebhookEvent } from "./webhooks";

const NOW = new Date();
const ISO = NOW.toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
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
    invoices: [
      {
        id: "inv1",
        studioId: "s1",
        memberId: "m1",
        number: "INV-2026-0001",
        status: "open",
        currency: "EUR",
        taxRateBps: 900,
        subtotalCents: 1000,
        taxCents: 90,
        totalCents: 1090,
        issuedAt: ISO,
        dueAt: null,
        paidAt: null,
        createdAt: ISO,
      },
    ],
    lineItems: [],
    outbox: [],
    webhookEvents: [],
    ...over,
  };
}

function invoicePaidEvent(eventId: string, invoiceId: string | undefined): StripeWebhookEventInput {
  return {
    id: eventId,
    type: "invoice.paid",
    data: { object: { metadata: invoiceId ? { invoice_id: invoiceId } : {} } },
  };
}

describe("handleStripeWebhookEvent", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(baseSeed());
  });

  it("marks the matching invoice paid on a verified invoice.paid event", async () => {
    await handleStripeWebhookEvent(repos, invoicePaidEvent("evt1", "inv1"));
    const invoice = await repos.invoices.getById("inv1");
    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).not.toBeNull();
  });

  it("is idempotent: replaying the same event id leaves the invoice paid exactly once", async () => {
    await handleStripeWebhookEvent(repos, invoicePaidEvent("evt1", "inv1"));
    const firstPaidAt = (await repos.invoices.getById("inv1"))?.paidAt;

    await handleStripeWebhookEvent(repos, invoicePaidEvent("evt1", "inv1"));
    const invoice = await repos.invoices.getById("inv1");

    expect(invoice?.status).toBe("paid");
    expect(invoice?.paidAt).toBe(firstPaidAt);
  });

  it("changes nothing for an invoice.paid event naming an unknown invoice", async () => {
    await handleStripeWebhookEvent(repos, invoicePaidEvent("evt2", "does-not-exist"));
    const invoice = await repos.invoices.getById("inv1");
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });

  it("changes nothing for an event of another type", async () => {
    await handleStripeWebhookEvent(repos, {
      id: "evt3",
      type: "customer.created",
      data: { object: { metadata: {} } },
    });
    const invoice = await repos.invoices.getById("inv1");
    expect(invoice?.status).toBe("open");
    expect(invoice?.paidAt).toBeNull();
  });
});
