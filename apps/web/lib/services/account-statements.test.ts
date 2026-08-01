import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Invoice, InvoiceLineItem } from "@/lib/db/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
import { getMemberStatement } from "./account-statements";

const ISSUED_AT = "2026-07-01T10:00:00.000Z";

function invoice(over: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    studioId: "studio-1",
    memberId: "member-1",
    number: "INV-2026-0001",
    status: "paid",
    currency: "EUR",
    taxRateBps: 900,
    subtotalCents: 10_000,
    taxCents: 900,
    totalCents: 10_900,
    issuedAt: ISSUED_AT,
    dueAt: null,
    paidAt: ISSUED_AT,
    createdAt: ISSUED_AT,
    ...over,
  };
}

function lineItem(id: string, unitAmountCents: number, refunded = false): InvoiceLineItem {
  return {
    id,
    invoiceId: "invoice-1",
    description: id,
    quantity: 1,
    unitAmountCents,
    amountCents: unitAmountCents,
    refunded,
    bookingId: null,
  };
}

function seed(invoiceRow: Invoice, lineItems: InvoiceLineItem[]): SeedData {
  return {
    studio: {
      id: "studio-1",
      name: "Studio",
      slug: "studio",
      timezone: "Europe/Amsterdam",
      createdAt: ISSUED_AT,
    },
    settings: {
      studioId: "studio-1",
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
    invoices: [invoiceRow],
    lineItems,
    outbox: [],
  };
}

describe("account statements service", () => {
  it("excludes refunded lines from the taxable subtotal", async () => {
    const lineItems = [lineItem("billable", 10_000), lineItem("refunded", 5_000, true)];
    const expected = computeInvoiceTotals(lineItems, 900);
    const storedInvoice = invoice({
      subtotalCents: expected.subtotalCents,
      taxCents: expected.taxCents,
      totalCents: expected.totalCents,
    });
    const repos = createInMemoryRepositories(seed(storedInvoice, lineItems));

    const statement = await getMemberStatement(repos, "studio-1", "member-1");

    expect(expected.totalCents).toBe(10_900);
    expect(statement.lines[0]?.totalCents).toBe(expected.totalCents);
    expect(statement.lines[0]?.totalCents).toBe(storedInvoice.totalCents);
    expect(statement.lines[0]?.totalCents).not.toBe(16_350);
    expect(statement.balanceCents).toBe(10_900);
  });

  it("matches canonical totals when no lines are refunded", async () => {
    const lineItems = [lineItem("membership", 7_500), lineItem("class", 2_500)];
    const expected = computeInvoiceTotals(lineItems, 900);
    const storedInvoice = invoice({
      subtotalCents: expected.subtotalCents,
      taxCents: expected.taxCents,
      totalCents: expected.totalCents,
    });
    const repos = createInMemoryRepositories(seed(storedInvoice, lineItems));

    const statement = await getMemberStatement(repos, "studio-1", "member-1");

    expect(statement.lines[0]?.totalCents).toBe(expected.totalCents);
    expect(statement.lines[0]?.totalCents).toBe(storedInvoice.totalCents);
    expect(statement.balanceCents).toBe(expected.totalCents);
  });
});
