import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Invoice, InvoiceLineItem } from "@/lib/db/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
import { getMemberStatement } from "./account-statements";

const ISO = "2026-03-01T00:00:00Z";

function seed(over: Partial<SeedData> = {}): SeedData {
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
    members: [
      {
        id: "m1",
        studioId: "s1",
        name: "M",
        email: "m@e.co",
        phone: null,
        status: "active",
        notificationsOptedOut: false,
        createdAt: ISO,
      },
    ],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: "inv1",
  studioId: "s1",
  memberId: "m1",
  number: "INV-2026-0001",
  status: "open",
  currency: "EUR",
  taxRateBps: 900,
  subtotalCents: 10000,
  taxCents: 900,
  totalCents: 10900,
  issuedAt: ISO,
  dueAt: null,
  paidAt: null,
  createdAt: ISO,
  ...over,
});

const line = (over: Partial<InvoiceLineItem> = {}): InvoiceLineItem => ({
  id: "li1",
  invoiceId: "inv1",
  description: "Class",
  quantity: 1,
  unitAmountCents: 10000,
  amountCents: 10000,
  refunded: false,
  bookingId: null,
  ...over,
});

describe("getMemberStatement", () => {
  it("excludes refunded lines from the taxable subtotal", async () => {
    // €100 billable + €50 refunded at 9%: tax applies to €100 only -> €109.00.
    const inv = invoice();
    const repos = createInMemoryRepositories(
      seed({
        invoices: [inv],
        lineItems: [
          line(),
          line({
            id: "li2",
            description: "Refunded class",
            unitAmountCents: 5000,
            amountCents: 5000,
            refunded: true,
          }),
        ],
      }),
    );
    const statement = await getMemberStatement(repos, "s1", "m1");
    const canonical = computeInvoiceTotals(
      [
        { quantity: 1, unitAmountCents: 10000 },
        { quantity: 1, unitAmountCents: 5000, refunded: true },
      ],
      900,
    );
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].totalCents).toBe(10900);
    expect(statement.lines[0].totalCents).toBe(canonical.totalCents);
    expect(statement.lines[0].totalCents).toBe(inv.totalCents);
    expect(statement.lines[0].totalCents).not.toBe(16350);
    expect(statement.balanceCents).toBe(10900);
  });

  it("is unchanged for invoices without refunded lines", async () => {
    const inv = invoice();
    const repos = createInMemoryRepositories(seed({ invoices: [inv], lineItems: [line()] }));
    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines[0].totalCents).toBe(10900);
    expect(statement.balanceCents).toBe(10900);
  });
});
