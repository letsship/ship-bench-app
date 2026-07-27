import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Invoice, InvoiceLineItem, Member } from "@/lib/db/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
import { getMemberStatement } from "./account-statements";

const ISO = "2026-01-01T00:00:00.000Z";

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
  it("excludes a refunded line from the taxable subtotal, matching computeInvoiceTotals and the stored invoice total", async () => {
    const items = [
      lineItem("li1", "inv1", { unitAmountCents: 10_000 }),
      lineItem("li2", "inv1", { unitAmountCents: 5_000, refunded: true }),
    ];
    const totals = computeInvoiceTotals(items, 900);
    expect(totals.totalCents).toBe(10_900);

    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        invoices: [
          invoice("inv1", "m1", {
            subtotalCents: totals.subtotalCents,
            taxCents: totals.taxCents,
            totalCents: totals.totalCents,
          }),
        ],
        lineItems: items,
      }),
    );

    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].totalCents).toBe(10_900);
    expect(statement.lines[0].totalCents).not.toBe(16_350);
    expect(statement.lines[0].totalCents).toBe(totals.totalCents);

    const stored = await repos.invoices.getById("inv1");
    expect(statement.lines[0].totalCents).toBe(stored?.totalCents);
  });

  it("matches the invoice total unchanged when no line is refunded", async () => {
    const items = [lineItem("li1", "inv1", { quantity: 2, unitAmountCents: 1_000 })];
    const totals = computeInvoiceTotals(items, 900);

    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        invoices: [
          invoice("inv1", "m1", {
            subtotalCents: totals.subtotalCents,
            taxCents: totals.taxCents,
            totalCents: totals.totalCents,
          }),
        ],
        lineItems: items,
      }),
    );

    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines[0].totalCents).toBe(totals.totalCents);
    expect(statement.balanceCents).toBe(totals.totalCents);
  });
});
