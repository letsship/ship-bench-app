import { describe, expect, it } from "vitest";
import {
  canTransitionInvoice,
  computeInvoiceTotals,
  formatInvoiceNumber,
  type InvoiceStatus,
  isOverdue,
  lineAmountCents,
} from "./invoices";

describe("lineAmountCents", () => {
  it("multiplies quantity by unit amount", () => {
    expect(lineAmountCents({ quantity: 3, unitAmountCents: 500 })).toBe(1500);
  });
});

describe("computeInvoiceTotals", () => {
  it("returns zero payable totals for an empty list", () => {
    expect(() => computeInvoiceTotals([], 2100)).not.toThrow();
    expect(computeInvoiceTotals([], 2100)).toEqual({
      subtotalCents: 0,
      refundedCents: 0,
      taxCents: 0,
      totalCents: 0,
    });
  });

  it("returns zero payable totals when every line is refunded", () => {
    const items = [
      { quantity: 1, unitAmountCents: 1000, refunded: true },
      { quantity: 2, unitAmountCents: 500, refunded: true },
    ];

    expect(() => computeInvoiceTotals(items, 900)).not.toThrow();
    expect(computeInvoiceTotals(items, 900)).toEqual({
      subtotalCents: 0,
      refundedCents: 2000,
      taxCents: 0,
      totalCents: 0,
    });
  });

  it("excludes refunded lines from the subtotal and tax but tracks them", () => {
    expect(
      computeInvoiceTotals(
        [
          { quantity: 1, unitAmountCents: 1000 },
          { quantity: 2, unitAmountCents: 500, refunded: true },
        ],
        900,
      ),
    ).toEqual({
      subtotalCents: 1000,
      refundedCents: 1000,
      taxCents: 90,
      totalCents: 1090,
    });
  });

  it("rounds tax half-up", () => {
    // 1000 * 5 / 10000 = 0.5 -> rounds to 1
    expect(computeInvoiceTotals([{ quantity: 1, unitAmountCents: 1000 }], 5).taxCents).toBe(1);
    // 1000 * 4 / 10000 = 0.4 -> rounds to 0
    expect(computeInvoiceTotals([{ quantity: 1, unitAmountCents: 1000 }], 4).taxCents).toBe(0);
  });

  it("is zero across the board for a zero-amount line", () => {
    expect(computeInvoiceTotals([{ quantity: 1, unitAmountCents: 0 }], 2100)).toEqual({
      subtotalCents: 0,
      refundedCents: 0,
      taxCents: 0,
      totalCents: 0,
    });
  });
});

describe("formatInvoiceNumber", () => {
  it("zero-pads the sequence within a year", () => {
    expect(formatInvoiceNumber(7, 2026)).toBe("INV-2026-0007");
    expect(formatInvoiceNumber(1234, 2026)).toBe("INV-2026-1234");
  });
});

describe("canTransitionInvoice", () => {
  const valid: [InvoiceStatus, InvoiceStatus][] = [
    ["draft", "open"],
    ["draft", "void"],
    ["open", "paid"],
    ["open", "void"],
    ["paid", "refunded"],
  ];
  const invalid: [InvoiceStatus, InvoiceStatus][] = [
    ["draft", "paid"],
    ["open", "draft"],
    ["paid", "open"],
    ["void", "open"],
    ["refunded", "paid"],
  ];

  it.each(valid)("allows %s -> %s", (from, to) => {
    expect(canTransitionInvoice(from, to)).toBe(true);
  });

  it.each(invalid)("rejects %s -> %s", (from, to) => {
    expect(canTransitionInvoice(from, to)).toBe(false);
  });
});

describe("isOverdue", () => {
  const now = "2026-03-15T00:00:00Z";

  it("is overdue when open and past due", () => {
    expect(isOverdue({ status: "open", dueAt: "2026-03-10T00:00:00Z" }, now)).toBe(true);
  });

  it("is not overdue when paid", () => {
    expect(isOverdue({ status: "paid", dueAt: "2026-03-10T00:00:00Z" }, now)).toBe(false);
  });

  it("is not overdue without a due date", () => {
    expect(isOverdue({ status: "open", dueAt: null }, now)).toBe(false);
  });

  it("is not overdue before the due date", () => {
    expect(isOverdue({ status: "open", dueAt: "2026-03-20T00:00:00Z" }, now)).toBe(false);
  });
});
