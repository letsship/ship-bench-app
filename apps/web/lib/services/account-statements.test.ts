import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice, InvoiceLineItem, Member } from "@/lib/db/types";
import { buildSeed } from "@/lib/db/seed-data";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
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
  number: id,
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

const line = (id: string, invoiceId: string, over: Partial<InvoiceLineItem> = {}): InvoiceLineItem => ({
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
  let repos: Repositories;
  let studioId: string;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
  });

  async function seedMemberWithInvoice(
    memberId: string,
    lines: InvoiceLineItem[],
    invoiceOver: Partial<Invoice> = {},
  ): Promise<{ invoice: Invoice }> {
    studioId = "s1";
    const items = lines.map((l, i) => ({
      ...l,
      id: `li-${memberId}-${i}`,
      invoiceId: `inv-${memberId}`,
      amountCents: l.quantity * l.unitAmountCents,
    }));
    const totals = computeInvoiceTotals(items, (invoiceOver.taxRateBps ?? 900));
    const inv = invoice(`inv-${memberId}`, memberId, {
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      ...invoiceOver,
    });
    const seed = baseSeed({
      members: [member(memberId)],
      invoices: [inv],
      lineItems: items,
    });
    repos = createInMemoryRepositories(seed);
    return { invoice: (await repos.invoices.getById(inv.id))! };
  }

  it("excludes a refunded line from the taxable subtotal (EUR109.00 example)", async () => {
    // EUR100 billable + EUR50 refunded @ 9% => taxable subtotal 10000 cents,
    // tax 900 cents, total 10900 cents (EUR109.00) — not the over-taxed 16350.
    const { invoice: inv } = await seedMemberWithInvoice("m1", [
      line("billable", "", { quantity: 1, unitAmountCents: 10000, refunded: false }),
      line("refunded", "", { quantity: 1, unitAmountCents: 5000, refunded: true }),
    ]);

    const statement = await getMemberStatement(repos, studioId, "m1");
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].totalCents).toBe(10900);
    expect(statement.balanceCents).toBe(10900);

    // Agrees with the canonical domain calculation and the stored invoice total.
    const items = await repos.invoiceLineItems.listByInvoice(inv.id);
    expect(computeInvoiceTotals(items, inv.taxRateBps).totalCents).toBe(10900);
    expect(inv.totalCents).toBe(10900);
    expect(statement.lines[0].totalCents).toBe(inv.totalCents);
  });

  it("matches the stored total for an invoice with no refunded lines", async () => {
    // EUR100 + EUR50 billable @ 9% => subtotal 15000, tax 1350, total 16350.
    const { invoice: inv } = await seedMemberWithInvoice("m1", [
      line("a", "", { quantity: 1, unitAmountCents: 10000, refunded: false }),
      line("b", "", { quantity: 1, unitAmountCents: 5000, refunded: false }),
    ]);

    const statement = await getMemberStatement(repos, studioId, "m1");
    const items = await repos.invoiceLineItems.listByInvoice(inv.id);
    const canonical = computeInvoiceTotals(items, inv.taxRateBps).totalCents;
    expect(canonical).toBe(16350);
    expect(statement.lines[0].totalCents).toBe(canonical);
    expect(statement.lines[0].totalCents).toBe(inv.totalCents);
    expect(statement.balanceCents).toBe(16350);
  });
});
