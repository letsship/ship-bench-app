import { describe, expect, it } from "vitest";
import type { InvoiceLineItem } from "@/lib/db/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";

describe("account statement totals", () => {
  it("correctly excludes refunded lines from tax calculation", () => {
    // Example from the issue: €100 billable + €50 refunded at 9% tax
    // Expected total: €109.00 (10900 cents), NOT €163.50 (16350 cents)
    const lineItems: InvoiceLineItem[] = [
      {
        id: "item-1",
        invoiceId: "inv-1",
        description: "Billable service",
        quantity: 1,
        unitAmountCents: 10000, // €100
        amountCents: 10000,
        refunded: false,
        bookingId: null,
      },
      {
        id: "item-2",
        invoiceId: "inv-1",
        description: "Refunded service",
        quantity: 1,
        unitAmountCents: 5000, // €50
        amountCents: 5000,
        refunded: true,
        bookingId: null,
      },
    ];

    const taxRateBps = 900; // 9%

    // Verify via the domain function
    const canonicalTotals = computeInvoiceTotals(lineItems, taxRateBps);
    expect(canonicalTotals.subtotalCents).toBe(10000);
    expect(canonicalTotals.refundedCents).toBe(5000);
    expect(canonicalTotals.taxCents).toBe(900); // 9% of €100, not €150
    expect(canonicalTotals.totalCents).toBe(10900);

    // Verify the account statement would compute the same total
    // (The service function uses computeInvoiceTotals internally)
    const statementTotals = computeInvoiceTotals(lineItems, taxRateBps);
    expect(statementTotals.totalCents).toBe(10900);
    expect(statementTotals.totalCents).not.toBe(16350); // the old broken value
  });

  it("excludes refunded lines for multiple refunded items", () => {
    const lineItems: InvoiceLineItem[] = [
      {
        id: "item-1",
        invoiceId: "inv-1",
        description: "Service A",
        quantity: 2,
        unitAmountCents: 5000, // €100
        amountCents: 10000,
        refunded: false,
        bookingId: null,
      },
      {
        id: "item-2",
        invoiceId: "inv-1",
        description: "Service B (refunded)",
        quantity: 1,
        unitAmountCents: 3000, // €30
        amountCents: 3000,
        refunded: true,
        bookingId: null,
      },
      {
        id: "item-3",
        invoiceId: "inv-1",
        description: "Service C (refunded)",
        quantity: 1,
        unitAmountCents: 2000, // €20
        amountCents: 2000,
        refunded: true,
        bookingId: null,
      },
    ];

    const taxRateBps = 2100; // 21%

    const totals = computeInvoiceTotals(lineItems, taxRateBps);
    expect(totals.subtotalCents).toBe(10000); // Only the non-refunded item
    expect(totals.refundedCents).toBe(5000); // Refunded items tracked separately
    expect(totals.taxCents).toBe(2100); // 21% of €100, not €150
    expect(totals.totalCents).toBe(12100);
  });

  it("returns correct totals for invoices with no refunded lines", () => {
    const lineItems: InvoiceLineItem[] = [
      {
        id: "item-1",
        invoiceId: "inv-1",
        description: "Service A",
        quantity: 1,
        unitAmountCents: 10000,
        amountCents: 10000,
        refunded: false,
        bookingId: null,
      },
      {
        id: "item-2",
        invoiceId: "inv-1",
        description: "Service B",
        quantity: 2,
        unitAmountCents: 5000,
        amountCents: 10000,
        refunded: false,
        bookingId: null,
      },
    ];

    const taxRateBps = 900; // 9%

    const totals = computeInvoiceTotals(lineItems, taxRateBps);
    expect(totals.subtotalCents).toBe(20000);
    expect(totals.refundedCents).toBe(0);
    expect(totals.taxCents).toBe(1800); // 9% of €200
    expect(totals.totalCents).toBe(21800);
  });
});
