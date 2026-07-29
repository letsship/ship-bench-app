import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Invoice, InvoiceLineItem, Member } from "@/lib/db/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
import { getMemberStatement } from "./account-statements";

const ISO = new Date().toISOString();

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
    members: [member("m1")],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

const member = (id: string, over: Partial<Member> = {}): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
  ...over,
});

// The stored invoice carries the canonical domain totals, as written at create
// time.
const invoice = (
  id: string,
  items: readonly InvoiceLineItem[],
  over: Partial<Invoice> = {},
): Invoice => {
  const totals = computeInvoiceTotals(items, 900);
  return {
    id,
    studioId: "s1",
    memberId: "m1",
    number: `INV-2026-${id}`,
    status: "open",
    currency: "EUR",
    taxRateBps: 900,
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    issuedAt: ISO,
    dueAt: null,
    paidAt: null,
    createdAt: ISO,
    ...over,
  };
};

const lineItem = (
  id: string,
  invoiceId: string,
  over: Partial<InvoiceLineItem> = {},
): InvoiceLineItem => ({
  id,
  invoiceId,
  description: id,
  quantity: 1,
  unitAmountCents: 0,
  amountCents: 0,
  refunded: false,
  bookingId: null,
  ...over,
});

describe("account statements service", () => {
  it("excludes a refunded line from the taxable subtotal, matching the stored invoice", async () => {
    // €100 billable + €50 refunded at 9% tax: tax applies to the €100 only.
    const items = [
      lineItem("li1", "inv1", {
        description: "Pass",
        unitAmountCents: 10_000,
        amountCents: 10_000,
      }),
      lineItem("li2", "inv1", {
        description: "Refunded mat",
        unitAmountCents: 5_000,
        amountCents: 5_000,
        refunded: true,
      }),
    ];
    const stored = invoice("inv1", items);
    const repos = createInMemoryRepositories(baseSeed({ invoices: [stored], lineItems: items }));

    const statement = await getMemberStatement(repos, "s1", "m1");
    const domain = computeInvoiceTotals(items, stored.taxRateBps);

    expect(domain.totalCents).toBe(10_900);
    expect(stored.totalCents).toBe(10_900);
    expect(statement.lines).toHaveLength(1);
    // Statement total equals the domain result and the stored invoice total —
    // never the over-taxed 16350 that taxes the refunded line too.
    expect(statement.lines[0].totalCents).toBe(10_900);
    expect(statement.lines[0].totalCents).toBe(domain.totalCents);
    expect(statement.lines[0].totalCents).toBe(stored.totalCents);
    expect(statement.balanceCents).toBe(10_900);
    expect(statement.balanceCents).not.toBe(16_350);
  });

  it("leaves invoices without refunded lines unchanged", async () => {
    const items = [
      lineItem("li1", "inv1", {
        description: "Pass",
        quantity: 2,
        unitAmountCents: 1_000,
        amountCents: 2_000,
      }),
    ];
    const stored = invoice("inv1", items);
    const repos = createInMemoryRepositories(baseSeed({ invoices: [stored], lineItems: items }));

    const statement = await getMemberStatement(repos, "s1", "m1");
    const domain = computeInvoiceTotals(items, stored.taxRateBps);

    expect(statement.lines[0].totalCents).toBe(2_180);
    expect(statement.lines[0].totalCents).toBe(domain.totalCents);
    expect(statement.lines[0].totalCents).toBe(stored.totalCents);
    expect(statement.balanceCents).toBe(2_180);
  });
});
