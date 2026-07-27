import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice, InvoiceLineItem, Member } from "@/lib/db/types";
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

describe("account statements service", () => {
  let repos: Repositories;
  const studioId = "s1";
  const memberId = "m1";

  it("excludes a refunded line from the taxable subtotal, matching computeInvoiceTotals and the stored invoice", async () => {
    const items = [
      lineItem("li1", "inv1", {
        description: "Billable",
        quantity: 1,
        unitAmountCents: 10_000,
        amountCents: 10_000,
      }),
      lineItem("li2", "inv1", {
        description: "Refunded",
        quantity: 1,
        unitAmountCents: 5_000,
        amountCents: 5_000,
        refunded: true,
      }),
    ];
    const canonical = computeInvoiceTotals(items, 900);
    expect(canonical.totalCents).toBe(10_900);

    repos = createInMemoryRepositories(
      baseSeed({
        members: [member(memberId)],
        invoices: [
          invoice("inv1", memberId, {
            subtotalCents: canonical.subtotalCents,
            taxCents: canonical.taxCents,
            totalCents: canonical.totalCents,
          }),
        ],
        lineItems: items,
      }),
    );

    const statement = await getMemberStatement(repos, studioId, memberId);
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].totalCents).toBe(10_900);
    expect(statement.lines[0].totalCents).not.toBe(16_350);
    expect(statement.balanceCents).toBe(10_900);

    const storedInvoice = await repos.invoices.getById("inv1");
    expect(statement.lines[0].totalCents).toBe(storedInvoice?.totalCents);
  });

  it("is unchanged for an invoice with no refunded lines", async () => {
    const items = [
      lineItem("li1", "inv1", {
        description: "Pass",
        quantity: 2,
        unitAmountCents: 1_000,
        amountCents: 2_000,
      }),
    ];
    const canonical = computeInvoiceTotals(items, 900);

    repos = createInMemoryRepositories(
      baseSeed({
        members: [member(memberId)],
        invoices: [
          invoice("inv1", memberId, {
            subtotalCents: canonical.subtotalCents,
            taxCents: canonical.taxCents,
            totalCents: canonical.totalCents,
          }),
        ],
        lineItems: items,
      }),
    );

    const statement = await getMemberStatement(repos, studioId, memberId);
    expect(statement.lines[0].totalCents).toBe(canonical.totalCents);
    expect(statement.lines[0].totalCents).toBe(2_180);
  });
});
