import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice, InvoiceLineItem, Member } from "@/lib/db/types";
import { newId } from "@/lib/db/ids";
import { getMemberStatement } from "./account-statements";

const NOW = new Date();
const ISO = NOW.toISOString();

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

const invoice = (id: string, memberId: string, over: Partial<Invoice> = {}): Invoice => ({
  id,
  studioId: "s1",
  memberId,
  number: "INV-2026-0001",
  status: "open",
  currency: "EUR",
  taxRateBps: 900,
  subtotalCents: 10000,
  taxCents: 900,
  totalCents: 10900,
  issuedAt: ISO,
  dueAt: ISO,
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
  unitAmountCents: 1000,
  amountCents: 1000,
  refunded: false,
  bookingId: null,
  ...over,
});

describe("account statements service", () => {
  let repos: Repositories;
  let studioId: string;
  let memberId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
    studioId = "s1";
    memberId = "m1";
  });

  it("excludes refunded lines from the taxable subtotal", async () => {
    // €100 billable + €50 refunded @ 9% should be €109.00 (10900 cents)
    const invoiceId = newId();
    const invWithRefund = invoice("inv1", memberId, {
      id: invoiceId,
      subtotalCents: 10000,
      refundedCents: 5000,
      taxCents: 900,
      totalCents: 10900,
    });
    await repos.invoices.insert(invWithRefund);
    await repos.invoiceLineItems.insertMany([
      lineItem(newId(), invoiceId, { unitAmountCents: 10000 }),
      lineItem(newId(), invoiceId, { unitAmountCents: 5000, refunded: true }),
    ]);

    const statement = await getMemberStatement(repos, studioId, memberId);
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].totalCents).toBe(10900); // Excludes the refunded line from tax
    expect(statement.balanceCents).toBe(10900);
  });

  it("matches the stored invoice total for non-refunded invoices", async () => {
    const invoiceId = newId();
    const simpleInvoice = invoice("inv1", memberId, { id: invoiceId });
    await repos.invoices.insert(simpleInvoice);
    await repos.invoiceLineItems.insertMany([
      lineItem(newId(), invoiceId, { unitAmountCents: 10000 }),
    ]);

    const statement = await getMemberStatement(repos, studioId, memberId);
    expect(statement.lines[0].totalCents).toBe(simpleInvoice.totalCents);
  });

  it("sums multiple invoices into balance", async () => {
    const inv1 = await repos.invoices.insert(invoice("inv1", memberId));
    await repos.invoiceLineItems.insertMany([
      lineItem(newId(), inv1.id, { unitAmountCents: 10000, amountCents: 10000 }),
    ]);
    const inv2 = await repos.invoices.insert(
      invoice("inv2", memberId, {
        id: newId(),
        subtotalCents: 5000,
        taxCents: 450,
        totalCents: 5450,
      }),
    );
    await repos.invoiceLineItems.insertMany([
      lineItem(newId(), inv2.id, { unitAmountCents: 5000, amountCents: 5000 }),
    ]);

    const statement = await getMemberStatement(repos, studioId, memberId);
    expect(statement.lines).toHaveLength(2);
    expect(statement.balanceCents).toBe(10900 + 5450); // 16350
  });
});
