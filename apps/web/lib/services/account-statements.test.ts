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
  number: `INV-2026-${id}`,
  status: "open",
  currency: "EUR",
  taxRateBps: 900,
  subtotalCents: 10_000,
  taxCents: 900,
  totalCents: 10_900,
  issuedAt: ISO,
  dueAt: null,
  paidAt: null,
  createdAt: ISO,
  ...over,
});

const lineItem = (
  id: string,
  invoiceId: string,
  unitAmountCents: number,
  over: Partial<InvoiceLineItem> = {},
): InvoiceLineItem => ({
  id,
  invoiceId,
  description: "Line",
  quantity: 1,
  unitAmountCents,
  amountCents: unitAmountCents,
  refunded: false,
  bookingId: null,
  ...over,
});

describe("account statements service", () => {
  it("excludes refunded lines from the taxable subtotal, matching the stored invoice", async () => {
    const items = [
      lineItem("li1", "inv1", 10_000),
      lineItem("li2", "inv1", 5_000, { refunded: true }),
    ];
    const stored = invoice("inv1", "m1");
    const repos = createInMemoryRepositories(
      baseSeed({ members: [member("m1")], invoices: [stored], lineItems: items }),
    );

    const statement = await getMemberStatement(repos, "s1", "m1");

    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].totalCents).toBe(10_900);
    expect(statement.lines[0].totalCents).toBe(computeInvoiceTotals(items, 900).totalCents);
    expect(statement.lines[0].totalCents).toBe(stored.totalCents);
    expect(statement.lines[0].totalCents).not.toBe(16_350);
    expect(statement.balanceCents).toBe(10_900);
  });

  it("leaves invoices without refunded lines unchanged", async () => {
    const stored = invoice("inv1", "m1", {
      subtotalCents: 2_000,
      taxCents: 180,
      totalCents: 2_180,
    });
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        invoices: [stored],
        lineItems: [lineItem("li1", "inv1", 2_000)],
      }),
    );

    const statement = await getMemberStatement(repos, "s1", "m1");

    expect(statement.lines[0].totalCents).toBe(2_180);
    expect(statement.lines[0].totalCents).toBe(stored.totalCents);
    expect(statement.balanceCents).toBe(2_180);
  });

  it("only includes the requested member's invoices", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1"), member("m2")],
        invoices: [invoice("inv1", "m1"), invoice("inv2", "m2")],
        lineItems: [lineItem("li1", "inv1", 10_000), lineItem("li2", "inv2", 10_000)],
      }),
    );

    const statement = await getMemberStatement(repos, "s1", "m2");

    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].invoiceId).toBe("inv2");
  });
});
