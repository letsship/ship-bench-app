import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Invoice, InvoiceLineItem, Member } from "@/lib/db/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
import { getMemberStatement } from "./account-statements";

const ISO = new Date("2026-03-01T10:00:00.000Z").toISOString();
const TAX_RATE_BPS = 900; // 9%

const member: Member = {
  id: "m1",
  studioId: "s1",
  name: "Mara",
  email: "mara@e.co",
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
};

const lineItem = (over: Partial<InvoiceLineItem> & { id: string }): InvoiceLineItem => ({
  invoiceId: "i1",
  description: "Pass",
  quantity: 1,
  unitAmountCents: 10_000,
  amountCents: 10_000,
  refunded: false,
  bookingId: null,
  ...over,
});

// Builds an invoice whose stored totals come from the canonical domain
// calculation, exactly as `createInvoice` does.
function seedWith(lineItems: InvoiceLineItem[]): { seed: SeedData; invoice: Invoice } {
  const totals = computeInvoiceTotals(lineItems, TAX_RATE_BPS);
  const invoice: Invoice = {
    id: "i1",
    studioId: "s1",
    memberId: "m1",
    number: "INV-2026-0001",
    status: "open",
    currency: "EUR",
    taxRateBps: TAX_RATE_BPS,
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    issuedAt: ISO,
    dueAt: null,
    paidAt: null,
    createdAt: ISO,
  };
  return {
    invoice,
    seed: {
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
      members: [member],
      classTypes: [],
      sessions: [],
      bookings: [],
      invoices: [invoice],
      lineItems,
      outbox: [],
    },
  };
}

describe("account statements", () => {
  it("excludes a refunded line from the taxable subtotal", async () => {
    // EUR100 billable + EUR50 refunded at 9%: tax applies to the EUR100 only.
    const lineItems = [
      lineItem({ id: "li1" }),
      lineItem({ id: "li2", unitAmountCents: 5_000, amountCents: 5_000, refunded: true }),
    ];
    const { seed, invoice } = seedWith(lineItems);
    const repos = createInMemoryRepositories(seed);

    const statement = await getMemberStatement(repos, "s1", "m1");

    const canonical = computeInvoiceTotals(lineItems, TAX_RATE_BPS);
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].totalCents).toBe(10_900);
    expect(statement.lines[0].subtotalCents).toBe(10_000);
    expect(statement.lines[0].taxCents).toBe(900);
    // The statement, the domain calculation, and the stored invoice all agree.
    expect(statement.lines[0].totalCents).toBe(canonical.totalCents);
    expect(statement.lines[0].totalCents).toBe(invoice.totalCents);
    expect(statement.balanceCents).toBe(10_900);
    // Never the figure produced by taxing the refunded line too.
    expect(statement.balanceCents).not.toBe(16_350);
  });

  it("is unchanged for an invoice with no refunded lines", async () => {
    const lineItems = [
      lineItem({ id: "li1" }),
      lineItem({ id: "li2", unitAmountCents: 5_000, amountCents: 5_000 }),
    ];
    const { seed, invoice } = seedWith(lineItems);
    const repos = createInMemoryRepositories(seed);

    const statement = await getMemberStatement(repos, "s1", "m1");

    expect(statement.lines[0].totalCents).toBe(16_350);
    expect(statement.lines[0].totalCents).toBe(invoice.totalCents);
    expect(statement.balanceCents).toBe(16_350);
  });

  it("sums every invoice belonging to the member only", async () => {
    const lineItems = [lineItem({ id: "li1" })];
    const { seed } = seedWith(lineItems);
    const otherMember: Member = { ...member, id: "m2", name: "Other", email: "other@e.co" };
    const otherInvoice: Invoice = {
      ...seed.invoices[0],
      id: "i2",
      memberId: "m2",
      number: "INV-2026-0002",
    };
    const repos = createInMemoryRepositories({
      ...seed,
      members: [member, otherMember],
      invoices: [...seed.invoices, otherInvoice],
      lineItems: [...lineItems, lineItem({ id: "li2", invoiceId: "i2" })],
    });

    const statement = await getMemberStatement(repos, "s1", "m1");

    expect(statement.lines.map((line) => line.invoiceId)).toEqual(["i1"]);
    expect(statement.balanceCents).toBe(10_900);
  });
});
