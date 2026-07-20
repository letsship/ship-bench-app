import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
import { getMemberStatement } from "./account-statements";

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
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

describe("account-statements service", () => {
  let repos: Repositories;
  beforeEach(async () => {
    repos = createInMemoryRepositories(baseSeed());
  });

  it("computes statement total for refunded line, excluding it from taxable subtotal", async () => {
    // €100 billable + €50 refunded at 9% tax should be €109.00 (10900 cents)
    // not €163.50 (16350 cents) from taxing the full €150
    const studioId = "s1";
    const memberId = "m1";

    await repos.members.insert({
      id: memberId,
      studioId,
      name: "Test Member",
      email: "test@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: ISO,
    });

    const invoiceId = "inv1";
    await repos.invoices.insert({
      id: invoiceId,
      studioId,
      memberId,
      number: "INV-2026-0001",
      status: "open",
      currency: "EUR",
      taxRateBps: 900,
      subtotalCents: 10000,
      taxCents: 900,
      totalCents: 10900,
      issuedAt: ISO,
      dueAt: ISO,
      paidAt: null,
      createdAt: ISO,
    });

    await repos.invoiceLineItems.insertMany([
      {
        id: "line1",
        invoiceId,
        description: "Service",
        quantity: 1,
        unitAmountCents: 10000,
        amountCents: 10000,
        refunded: false,
        bookingId: null,
      },
      {
        id: "line2",
        invoiceId,
        description: "Refunded service",
        quantity: 1,
        unitAmountCents: 5000,
        amountCents: 5000,
        refunded: true,
        bookingId: null,
      },
    ]);

    const statement = await getMemberStatement(repos, studioId, memberId);

    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].totalCents).toBe(10900);

    // Verify it matches computeInvoiceTotals result
    const domainTotals = computeInvoiceTotals(
      [
        { quantity: 1, unitAmountCents: 10000 },
        { quantity: 1, unitAmountCents: 5000, refunded: true },
      ],
      900,
    );
    expect(statement.lines[0].totalCents).toBe(domainTotals.totalCents);
  });

  it("computes statement total for invoice with no refunded lines", async () => {
    const studioId = "s1";
    const memberId = "m1";

    await repos.members.insert({
      id: memberId,
      studioId,
      name: "Test Member",
      email: "test@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: ISO,
    });

    const invoiceId = "inv1";
    await repos.invoices.insert({
      id: invoiceId,
      studioId,
      memberId,
      number: "INV-2026-0001",
      status: "open",
      currency: "EUR",
      taxRateBps: 900,
      subtotalCents: 2000,
      taxCents: 180,
      totalCents: 2180,
      issuedAt: ISO,
      dueAt: ISO,
      paidAt: null,
      createdAt: ISO,
    });

    await repos.invoiceLineItems.insertMany([
      {
        id: "line1",
        invoiceId,
        description: "Service",
        quantity: 2,
        unitAmountCents: 1000,
        amountCents: 2000,
        refunded: false,
        bookingId: null,
      },
    ]);

    const statement = await getMemberStatement(repos, studioId, memberId);

    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].totalCents).toBe(2180);

    // Verify it matches computeInvoiceTotals result
    const domainTotals = computeInvoiceTotals([{ quantity: 2, unitAmountCents: 1000 }], 900);
    expect(statement.lines[0].totalCents).toBe(domainTotals.totalCents);
  });

  it("aggregates statement balance correctly", async () => {
    const studioId = "s1";
    const memberId = "m1";

    await repos.members.insert({
      id: memberId,
      studioId,
      name: "Test Member",
      email: "test@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: ISO,
    });

    // Insert two invoices
    for (let i = 0; i < 2; i++) {
      const invoiceId = `inv${i + 1}`;
      await repos.invoices.insert({
        id: invoiceId,
        studioId,
        memberId,
        number: `INV-2026-000${i + 1}`,
        status: "open",
        currency: "EUR",
        taxRateBps: 900,
        subtotalCents: 1000,
        taxCents: 90,
        totalCents: 1090,
        issuedAt: ISO,
        dueAt: ISO,
        paidAt: null,
        createdAt: ISO,
      });

      await repos.invoiceLineItems.insertMany([
        {
          id: `line${i + 1}`,
          invoiceId,
          description: "Service",
          quantity: 1,
          unitAmountCents: 1000,
          amountCents: 1000,
          refunded: false,
          bookingId: null,
        },
      ]);
    }

    const statement = await getMemberStatement(repos, studioId, memberId);

    expect(statement.lines).toHaveLength(2);
    expect(statement.balanceCents).toBe(2180); // 1090 + 1090
  });
});
