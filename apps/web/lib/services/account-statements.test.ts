import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Invoice, InvoiceLineItem, Member, Studio, StudioSettings } from "@/lib/db/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
import { getMemberStatement } from "./account-statements";

const ISO = new Date().toISOString();

const studio: Studio = {
  id: "s1",
  name: "S",
  slug: "s",
  timezone: "Europe/Amsterdam",
  createdAt: ISO,
};

const settings: StudioSettings = {
  studioId: "s1",
  currency: "EUR",
  taxRateBps: 900,
  cancellationWindowHours: 12,
  waitlistEnabled: true,
  notifyBookingConfirmations: true,
  notifyCancellations: true,
  notifyWaitlistPromotions: true,
  notifyInvoices: true,
};

const member: Member = {
  id: "m1",
  studioId: "s1",
  name: "Member",
  email: "member@e.co",
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
};

function invoice(over: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv1",
    studioId: "s1",
    memberId: "m1",
    number: "INV-2026-0001",
    status: "open",
    currency: "EUR",
    taxRateBps: 900,
    subtotalCents: 0,
    taxCents: 0,
    totalCents: 0,
    issuedAt: ISO,
    dueAt: null,
    paidAt: null,
    createdAt: ISO,
    ...over,
  };
}

describe("getMemberStatement", () => {
  it("excludes a refunded line from the taxable subtotal, matching computeInvoiceTotals (issue example)", async () => {
    const lineItems: InvoiceLineItem[] = [
      {
        id: "li1",
        invoiceId: "inv1",
        description: "Billable",
        quantity: 1,
        unitAmountCents: 10_000,
        amountCents: 10_000,
        refunded: false,
        bookingId: null,
      },
      {
        id: "li2",
        invoiceId: "inv1",
        description: "Refunded",
        quantity: 1,
        unitAmountCents: 5_000,
        amountCents: 5_000,
        refunded: true,
        bookingId: null,
      },
    ];
    const expected = computeInvoiceTotals(lineItems, 900);
    expect(expected.totalCents).toBe(10_900);

    const repos = createInMemoryRepositories({
      studio,
      settings,
      members: [member],
      classTypes: [],
      sessions: [],
      bookings: [],
      invoices: [
        invoice({
          subtotalCents: expected.subtotalCents,
          taxCents: expected.taxCents,
          totalCents: expected.totalCents,
        }),
      ],
      lineItems,
      outbox: [],
    });

    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines).toEqual([
      { invoiceId: "inv1", number: "INV-2026-0001", totalCents: 10_900 },
    ]);
    expect(statement.lines[0].totalCents).not.toBe(16_350);
    expect(statement.balanceCents).toBe(10_900);
  });

  it("matches computeInvoiceTotals and the stored invoice total when nothing is refunded", async () => {
    const lineItems: InvoiceLineItem[] = [
      {
        id: "li1",
        invoiceId: "inv1",
        description: "Billable",
        quantity: 2,
        unitAmountCents: 1_500,
        amountCents: 3_000,
        refunded: false,
        bookingId: null,
      },
    ];
    const expected = computeInvoiceTotals(lineItems, 900);

    const repos = createInMemoryRepositories({
      studio,
      settings,
      members: [member],
      classTypes: [],
      sessions: [],
      bookings: [],
      invoices: [
        invoice({
          subtotalCents: expected.subtotalCents,
          taxCents: expected.taxCents,
          totalCents: expected.totalCents,
        }),
      ],
      lineItems,
      outbox: [],
    });

    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines[0].totalCents).toBe(expected.totalCents);
    expect(statement.lines[0].totalCents).toBe(3_270);
  });
});
