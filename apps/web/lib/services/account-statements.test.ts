import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Invoice, InvoiceLineItem, Member } from "@/lib/db/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
import { getMemberStatement } from "./account-statements";

const ISO = "2026-03-01T00:00:00.000Z";
const studioId = "studio-1";
const memberId = "member-1";

function invoice(id: string, totalCents: number): Invoice {
  return {
    id,
    studioId,
    memberId,
    number: `INV-2026-${id}`,
    status: "open",
    currency: "EUR",
    taxRateBps: 900,
    subtotalCents: totalCents,
    taxCents: 0,
    totalCents,
    issuedAt: ISO,
    dueAt: null,
    paidAt: null,
    createdAt: ISO,
  };
}

function lineItem(
  id: string,
  invoiceId: string,
  unitAmountCents: number,
  refunded = false,
): InvoiceLineItem {
  return {
    id,
    invoiceId,
    description: "Class pass",
    quantity: 1,
    unitAmountCents,
    amountCents: unitAmountCents,
    refunded,
    bookingId: null,
  };
}

const member: Member = {
  id: memberId,
  studioId,
  name: "Member",
  email: "member@example.com",
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
};

function seed(invoices: Invoice[], lineItems: InvoiceLineItem[]): SeedData {
  return {
    studio: { id: studioId, name: "Studio", slug: "studio", timezone: "UTC", createdAt: ISO },
    settings: {
      studioId,
      currency: "EUR",
      taxRateBps: 900,
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
    invoices,
    lineItems,
    outbox: [],
  };
}

describe("account statements", () => {
  it("matches the stored and canonical total when an invoice contains a refund", async () => {
    const items = [lineItem("line-1", "invoice-1", 10_000), lineItem("line-2", "invoice-1", 5_000, true)];
    const totals = computeInvoiceTotals(items, 900);
    const repos = createInMemoryRepositories(seed([invoice("invoice-1", totals.totalCents)], items));

    const statement = await getMemberStatement(repos, studioId, memberId);

    expect(totals.totalCents).toBe(10_900);
    expect(statement.lines[0]?.totalCents).toBe(totals.totalCents);
    expect(statement.lines[0]?.totalCents).toBe(10_900);
    expect(statement.lines[0]?.totalCents).not.toBe(16_350);
    expect((await repos.invoices.getById("invoice-1"))?.totalCents).toBe(statement.lines[0]?.totalCents);
  });

  it("leaves all-billable invoice totals unchanged", async () => {
    const items = [lineItem("line-1", "invoice-1", 10_000), lineItem("line-2", "invoice-1", 5_000)];
    const totals = computeInvoiceTotals(items, 900);
    const repos = createInMemoryRepositories(seed([invoice("invoice-1", totals.totalCents)], items));

    const statement = await getMemberStatement(repos, studioId, memberId);

    expect(totals.totalCents).toBe(16_350);
    expect(statement.lines[0]?.totalCents).toBe(totals.totalCents);
    expect((await repos.invoices.getById("invoice-1"))?.totalCents).toBe(statement.lines[0]?.totalCents);
  });
});
