import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice, Member } from "@/lib/db/types";
import { processStripeEvent } from "./stripe-webhooks";

const ISO = new Date().toISOString();

const member = (id: string): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
});

const invoice = (id: string, over: Partial<Invoice> = {}): Invoice => ({
  id,
  studioId: "s1",
  memberId: "m1",
  number: "INV-2026-0001",
  status: "open",
  currency: "EUR",
  taxRateBps: 900,
  subtotalCents: 5000,
  taxCents: 450,
  totalCents: 5450,
  issuedAt: ISO,
  dueAt: null,
  paidAt: null,
  createdAt: ISO,
  ...over,
});

function seed(): SeedData {
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
    members: [member("m1")],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [invoice("inv1")],
    lineItems: [],
    outbox: [],
  };
}

const paidEvent = (eventId: string, invoiceId = "inv1") => ({
  id: eventId,
  type: "invoice.paid",
  data: { object: { metadata: { invoice_id: invoiceId } } },
});

describe("processStripeEvent", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(seed());
  });

  it("marks the named invoice paid on invoice.paid", async () => {
    const result = await processStripeEvent(repos, paidEvent("evt_1"));
    expect(result).toEqual({ received: true, duplicate: false, invoiceMarkedPaid: true });
    const updated = await repos.invoices.getById("inv1");
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).toBeTruthy();
  });

  it("is idempotent: replaying the same event id changes nothing and does not throw", async () => {
    await processStripeEvent(repos, paidEvent("evt_1"));
    const afterFirst = await repos.invoices.getById("inv1");

    const replay = await processStripeEvent(repos, paidEvent("evt_1"));
    expect(replay).toEqual({ received: true, duplicate: true, invoiceMarkedPaid: false });
    expect(await repos.invoices.getById("inv1")).toEqual(afterFirst);
  });

  it("acknowledges an event naming an unknown invoice without changing anything", async () => {
    const result = await processStripeEvent(repos, paidEvent("evt_1", "inv_missing"));
    expect(result).toEqual({ received: true, duplicate: false, invoiceMarkedPaid: false });
    const untouched = await repos.invoices.getById("inv1");
    expect(untouched?.status).toBe("open");
    expect(untouched?.paidAt).toBeNull();
  });

  it("acknowledges other event types without changing anything", async () => {
    const result = await processStripeEvent(repos, {
      id: "evt_1",
      type: "customer.created",
      data: { object: { metadata: { invoice_id: "inv1" } } },
    });
    expect(result).toEqual({ received: true, duplicate: false, invoiceMarkedPaid: false });
    expect((await repos.invoices.getById("inv1"))?.status).toBe("open");
  });

  it("acknowledges an invoice.paid event without invoice metadata", async () => {
    const result = await processStripeEvent(repos, { id: "evt_1", type: "invoice.paid" });
    expect(result).toEqual({ received: true, duplicate: false, invoiceMarkedPaid: false });
    expect((await repos.invoices.getById("inv1"))?.status).toBe("open");
  });

  it("records every processed event id so any replay is skipped", async () => {
    await processStripeEvent(repos, { id: "evt_other", type: "customer.created" });
    const replay = await processStripeEvent(repos, { id: "evt_other", type: "customer.created" });
    expect(replay.duplicate).toBe(true);
  });
});
