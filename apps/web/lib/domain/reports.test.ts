import { describe, expect, it } from "vitest";
import { monthlyRevenue, revenueTotals } from "./reports";

const INVOICES = [
  { status: "paid", issuedAt: "2026-01-15T12:00:00Z", totalCents: 10000 },
  { status: "refunded", issuedAt: "2026-01-20T12:00:00Z", totalCents: 5000 },
  { status: "paid", issuedAt: "2026-02-10T12:00:00Z", totalCents: 8000 },
  { status: "draft", issuedAt: "2026-02-11T12:00:00Z", totalCents: 9999 },
];

describe("monthlyRevenue", () => {
  it("buckets by month and separates paid from refunded", () => {
    const rows = monthlyRevenue(INVOICES, "UTC");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      month: "2026-01",
      invoiceCount: 2,
      paidCents: 10000,
      refundedCents: 5000,
      netCents: 5000,
    });
    expect(rows[1]).toMatchObject({
      month: "2026-02",
      invoiceCount: 2,
      paidCents: 8000,
      refundedCents: 0,
      netCents: 8000,
    });
  });

  it("counts draft/void invoices but adds no revenue", () => {
    const rows = monthlyRevenue([{ status: "draft", issuedAt: "2026-03-01T00:00:00Z", totalCents: 500 }], "UTC");
    expect(rows[0]).toMatchObject({ invoiceCount: 1, paidCents: 0, refundedCents: 0, netCents: 0 });
  });

  it("returns months in ascending order", () => {
    const rows = monthlyRevenue(
      [
        { status: "paid", issuedAt: "2026-03-01T00:00:00Z", totalCents: 1 },
        { status: "paid", issuedAt: "2026-01-01T00:00:00Z", totalCents: 1 },
      ],
      "UTC",
    );
    expect(rows.map((row) => row.month)).toEqual(["2026-01", "2026-03"]);
  });

  it("buckets by the studio timezone", () => {
    const rows = monthlyRevenue(
      [{ status: "paid", issuedAt: "2026-01-31T23:30:00Z", totalCents: 100 }],
      "Europe/Amsterdam",
    );
    expect(rows[0].month).toBe("2026-02");
  });
});

describe("revenueTotals", () => {
  it("sums across months", () => {
    const totals = revenueTotals(monthlyRevenue(INVOICES, "UTC"));
    expect(totals).toEqual({ paidCents: 18000, refundedCents: 5000, netCents: 13000 });
  });
});
