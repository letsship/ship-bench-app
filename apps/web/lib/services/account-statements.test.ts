import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice, InvoiceLineItem, Member } from "@/lib/db/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
import { getMemberStatement } from "./account-statements";

const ISO = new Date().toISOString();
const TAX_RATE_BPS = 900; // 9%

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: TAX_RATE_BPS,
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

const invoice = (id: string, memberId: string, over: Partial<Invoice> = {}): Invoice => ({
  id,
  studioId: "s1",
  memberId,
  number: `INV-2026-${id}`,
  status: "open",
  currency: "EUR",
  taxRateBps: TAX_RATE_BPS,
  subtotalCents: 0,
  taxCents: 0,
  totalCents: 0,
  issuedAt: ISO,
  dueAt: null,
  paidAt: null,
  createdAt: ISO,
  ...over,
});

const line = (
  id: string,
  invoiceId: string,
  unitAmountCents: number,
  refunded = false,
): InvoiceLineItem => ({
  id,
  invoiceId,
  description: id,
  quantity: 1,
  unitAmountCents,
  amountCents: unitAmountCents,
  refunded,
  bookingId: null,
});

describe("account statements", () => {
  describe("an invoice with a refunded line", () => {
    // The issue's canonical example: a EUR100 billable line and a EUR50
    // refunded line at 9%.
    const BILLABLE = 10_000;
    const REFUNDED = 5_000;
    // Tax applies to the EUR100 only -> EUR109.00, not the over-taxed EUR163.50.
    const CANONICAL_TOTAL = 10_900;

    const items = [line("l1", "i1", BILLABLE), line("l2", "i1", REFUNDED, true)];
    let repos: Repositories;

    beforeEach(() => {
      repos = createInMemoryRepositories(
        baseSeed({
          members: [member("m1")],
          // Stored totals are what the domain function produces at create time.
          invoices: [
            invoice("i1", "m1", {
              subtotalCents: BILLABLE,
              taxCents: 900,
              totalCents: CANONICAL_TOTAL,
            }),
          ],
          lineItems: items,
        }),
      );
    });

    it("excludes the refunded line from the taxable subtotal", async () => {
      const statement = await getMemberStatement(repos, "s1", "m1");

      expect(statement.lines).toHaveLength(1);
      expect(statement.lines[0]).toMatchObject({
        invoiceId: "i1",
        subtotalCents: BILLABLE,
        refundedCents: REFUNDED,
        taxCents: 900,
        totalCents: CANONICAL_TOTAL,
      });
      // The over-taxed figure the drifted copy produced: (10000 + 5000) * 1.09.
      expect(statement.lines[0].totalCents).not.toBe(16_350);
      expect(statement.balanceCents).toBe(CANONICAL_TOTAL);
    });

    it("agrees with computeInvoiceTotals and the stored invoice total", async () => {
      const statement = await getMemberStatement(repos, "s1", "m1");
      const canonical = computeInvoiceTotals(items, TAX_RATE_BPS);
      const stored = await repos.invoices.getById("i1");

      expect(statement.lines[0].totalCents).toBe(canonical.totalCents);
      expect(statement.lines[0].totalCents).toBe(stored?.totalCents);
    });
  });

  it("is unchanged for an invoice with no refunded lines", async () => {
    const items = [line("l1", "i1", 2_000)];
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        invoices: [invoice("i1", "m1", { subtotalCents: 2_000, taxCents: 180, totalCents: 2_180 })],
        lineItems: items,
      }),
    );

    const statement = await getMemberStatement(repos, "s1", "m1");

    expect(statement.lines[0]).toMatchObject({
      subtotalCents: 2_000,
      refundedCents: 0,
      taxCents: 180,
      totalCents: 2_180,
    });
    expect(statement.balanceCents).toBe(2_180);
    expect(statement.lines[0].totalCents).toBe(
      computeInvoiceTotals(items, TAX_RATE_BPS).totalCents,
    );
  });

  it("rolls up only the requested member's invoices", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1"), member("m2")],
        invoices: [
          invoice("i1", "m1", { subtotalCents: 1_000, taxCents: 90, totalCents: 1_090 }),
          invoice("i2", "m2", { subtotalCents: 9_999, taxCents: 900, totalCents: 10_899 }),
        ],
        lineItems: [line("l1", "i1", 1_000), line("l2", "i2", 9_999)],
      }),
    );

    const statement = await getMemberStatement(repos, "s1", "m1");

    expect(statement.lines.map((l) => l.invoiceId)).toEqual(["i1"]);
    expect(statement.balanceCents).toBe(1_090);
  });
});
