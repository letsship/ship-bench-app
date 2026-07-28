import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice, InvoiceLineItem } from "@/lib/db/types";
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

const invoice = (id: string, memberId: string): Invoice => ({
  id,
  studioId: "s1",
  memberId,
  number: `INV-2026-${id.slice(-4)}`,
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
});

const line = (id: string, invoiceId: string, over: Partial<InvoiceLineItem>): InvoiceLineItem => ({
  id,
  invoiceId,
  description: "Item",
  quantity: 1,
  unitAmountCents: 0,
  amountCents: 0,
  refunded: false,
  bookingId: null,
  ...over,
});

describe("getMemberStatement", () => {
  it("excludes a refunded line from the taxable subtotal (matches the stored invoice total)", async () => {
    // 100.00 billable + 50.00 refunded at 9% -> 109.00 (10900c), never 163.50.
    const items = [
      line("li1", "inv1", { quantity: 1, unitAmountCents: 10000, amountCents: 10000 }),
      line("li2", "inv1", {
        quantity: 1,
        unitAmountCents: 5000,
        amountCents: 5000,
        refunded: true,
      }),
    ];
    const canonical = computeInvoiceTotals(items, 900).totalCents;
    const storedTotal = canonical;
    const seededInvoice = { ...invoice("inv1", "m1"), totalCents: storedTotal };

    const repos: Repositories = createInMemoryRepositories(
      baseSeed({
        members: [
          { id: "m1", studioId: "s1", name: "M", email: "m@e.co", phone: null, status: "active", notificationsOptedOut: false, createdAt: ISO },
        ],
        invoices: [seededInvoice],
        lineItems: items,
      }),
    );

    const statement = await getMemberStatement(repos, "s1", "m1");

    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].totalCents).toBe(canonical);
    expect(statement.lines[0].totalCents).toBe(storedTotal);
    expect(statement.balanceCents).toBe(10900);
    expect(statement.balanceCents).not.toBe(16350);
  });

  it("equals computeInvoiceTotals across an invoice with a refund and sums multiple invoices", async () => {
    const items1 = [
      line("li1", "inv1", { quantity: 1, unitAmountCents: 10000, amountCents: 10000 }),
      line("li2", "inv1", {
        quantity: 1,
        unitAmountCents: 5000,
        amountCents: 5000,
        refunded: true,
      }),
    ];
    const items2 = [line("li3", "inv2", { quantity: 2, unitAmountCents: 2500, amountCents: 5000 })];
    const expected1 = computeInvoiceTotals(items1, 900).totalCents;
    const expected2 = computeInvoiceTotals(items2, 900).totalCents;

    const repos: Repositories = createInMemoryRepositories(
      baseSeed({
        members: [
          { id: "m1", studioId: "s1", name: "M", email: "m@e.co", phone: null, status: "active", notificationsOptedOut: false, createdAt: ISO },
        ],
        invoices: [
          { ...invoice("inv1", "m1"), totalCents: expected1 },
          { ...invoice("inv2", "m1"), totalCents: expected2 },
        ],
        lineItems: [...items1, ...items2],
      }),
    );

    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines[0].totalCents).toBe(expected1);
    expect(statement.lines[1].totalCents).toBe(expected2);
    expect(statement.balanceCents).toBe(expected1 + expected2);
  });

  it("is unchanged from subtotal + tax for an invoice with no refunded lines", async () => {
    const items = [line("li1", "inv1", { quantity: 3, unitAmountCents: 1000, amountCents: 3000 })];
    const canonical = computeInvoiceTotals(items, 900).totalCents;
    const repos: Repositories = createInMemoryRepositories(
      baseSeed({
        members: [
          { id: "m1", studioId: "s1", name: "M", email: "m@e.co", phone: null, status: "active", notificationsOptedOut: false, createdAt: ISO },
        ],
        invoices: [{ ...invoice("inv1", "m1"), totalCents: canonical }],
        lineItems: items,
      }),
    );

    const statement = await getMemberStatement(repos, "s1", "m1");
    // 3000 subtotal + 270 tax = 3270.
    expect(statement.balanceCents).toBe(3270);
    expect(statement.balanceCents).toBe(canonical);
  });
});
