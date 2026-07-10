import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Invoice, InvoiceLineItem } from "@/lib/db/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
import { getMemberStatement } from "./account-statements";

const ISO = "2026-03-01T00:00:00.000Z";

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

const invoice = (id: string, memberId: string, over: Partial<Invoice> = {}): Invoice => ({
  id,
  studioId: "s1",
  memberId,
  number: `INV-2026-000${id}`,
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
});

const lineItem = (
  id: string,
  invoiceId: string,
  over: Partial<InvoiceLineItem> = {},
): InvoiceLineItem => ({
  id,
  invoiceId,
  description: "Line",
  quantity: 1,
  unitAmountCents: 0,
  amountCents: 0,
  refunded: false,
  bookingId: null,
  ...over,
});

describe("getMemberStatement", () => {
  it("excludes a refunded line from the taxable subtotal, matching computeInvoiceTotals", async () => {
    const items = [
      lineItem("li1", "inv1", { description: "Billable", quantity: 1, unitAmountCents: 10_000 }),
      lineItem("li2", "inv1", {
        description: "Refunded",
        quantity: 1,
        unitAmountCents: 5_000,
        refunded: true,
      }),
    ];
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [],
        invoices: [invoice("inv1", "m1", { taxRateBps: 900 })],
        lineItems: items,
      }),
    );

    const statement = await getMemberStatement(repos, "s1", "m1");

    const canonical = computeInvoiceTotals(items, 900);
    expect(canonical.totalCents).toBe(10_900);
    expect(statement.lines).toEqual([
      { invoiceId: "inv1", number: "INV-2026-000inv1", totalCents: 10_900 },
    ]);
    expect(statement.balanceCents).toBe(10_900);
    // Never the over-taxed figure that would result from taxing the refunded line too.
    expect(statement.balanceCents).not.toBe(16_350);
  });

  it("is unaffected by lines with no refunds", async () => {
    const items = [
      lineItem("li1", "inv1", { description: "Pass", quantity: 2, unitAmountCents: 1_000 }),
    ];
    const repos = createInMemoryRepositories(
      baseSeed({
        invoices: [invoice("inv1", "m1", { taxRateBps: 900 })],
        lineItems: items,
      }),
    );

    const statement = await getMemberStatement(repos, "s1", "m1");

    expect(statement.balanceCents).toBe(computeInvoiceTotals(items, 900).totalCents);
    expect(statement.balanceCents).toBe(2_180);
  });

  it("sums totals across multiple invoices for the same member", async () => {
    const itemsA = [lineItem("liA", "invA", { quantity: 1, unitAmountCents: 1_000 })];
    const itemsB = [lineItem("liB", "invB", { quantity: 1, unitAmountCents: 2_000 })];
    const repos = createInMemoryRepositories(
      baseSeed({
        invoices: [
          invoice("invA", "m1", { taxRateBps: 900 }),
          invoice("invB", "m1", { taxRateBps: 900 }),
        ],
        lineItems: [...itemsA, ...itemsB],
      }),
    );

    const statement = await getMemberStatement(repos, "s1", "m1");

    const totalA = computeInvoiceTotals(itemsA, 900).totalCents;
    const totalB = computeInvoiceTotals(itemsB, 900).totalCents;
    expect(statement.lines).toHaveLength(2);
    expect(statement.balanceCents).toBe(totalA + totalB);
  });
});
