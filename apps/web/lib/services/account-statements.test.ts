import { describe, expect, it } from "vitest";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { getMemberStatement } from "./account-statements";

const NOW = new Date("2026-07-01T12:00:00.000Z");

function reposWith(opts: {
  lineItems: { quantity: number; unitAmountCents: number; refunded: boolean }[];
  taxRateBps?: number;
}): Repositories {
  const taxRateBps = opts.taxRateBps ?? 900;
  const invoiceId = "inv-1";
  const lineItems = opts.lineItems.map((item, i) => ({
    id: `li-${i}`,
    invoiceId,
    description: "Line",
    quantity: item.quantity,
    unitAmountCents: item.unitAmountCents,
    amountCents: item.quantity * item.unitAmountCents,
    refunded: item.refunded,
    bookingId: null,
  }));
  return createInMemoryRepositories({
    studio: { id: "s1", name: "S", slug: "s", timezone: "UTC", createdAt: NOW.toISOString() },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    },
    members: [{ id: "m1", studioId: "s1", name: "M", email: "m@e.co", phone: null, status: "active", notificationsOptedOut: false, createdAt: NOW.toISOString() }],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [{
      id: invoiceId,
      studioId: "s1",
      memberId: "m1",
      number: "INV-2026-0001",
      status: "open",
      currency: "EUR",
      taxRateBps,
      subtotalCents: 0,
      taxCents: 0,
      totalCents: 0,
      issuedAt: NOW.toISOString(),
      dueAt: NOW.toISOString(),
      paidAt: null,
      createdAt: NOW.toISOString(),
    }],
    lineItems,
    outbox: [],
  });
}

describe("getMemberStatement", () => {
  it("excludes refunded lines from the taxable subtotal", async () => {
    const repos = reposWith({
      lineItems: [
        { quantity: 1, unitAmountCents: 10000, refunded: false },
        { quantity: 1, unitAmountCents: 5000, refunded: true },
      ],
      taxRateBps: 900,
    });
    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].totalCents).toBe(10900);
  });

  it("matches the canonical computeInvoiceTotals result", async () => {
    const repos = reposWith({
      lineItems: [
        { quantity: 1, unitAmountCents: 10000, refunded: false },
        { quantity: 1, unitAmountCents: 5000, refunded: true },
      ],
      taxRateBps: 900,
    });
    const canonical = computeInvoiceTotals(
      [
        { quantity: 1, unitAmountCents: 10000 },
        { quantity: 1, unitAmountCents: 5000, refunded: true },
      ],
      900,
    );
    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines[0].totalCents).toBe(canonical.totalCents);
  });

  it("never produces the over-taxed figure of 16350 for the example", async () => {
    const repos = reposWith({
      lineItems: [
        { quantity: 1, unitAmountCents: 10000, refunded: false },
        { quantity: 1, unitAmountCents: 5000, refunded: true },
      ],
      taxRateBps: 900,
    });
    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines[0].totalCents).not.toBe(16350);
  });

  it("works the same as the canonical function for a non-refunded invoice", async () => {
    const repos = reposWith({
      lineItems: [
        { quantity: 3, unitAmountCents: 2500, refunded: false },
      ],
      taxRateBps: 2100,
    });
    const canonical = computeInvoiceTotals(
      [{ quantity: 3, unitAmountCents: 2500 }],
      2100,
    );
    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines[0].totalCents).toBe(canonical.totalCents);
  });
});