import { describe, expect, it } from "vitest";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
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
    members: [
      {
        id: "m1",
        studioId: "s1",
        name: "Amara",
        email: "amara@example.com",
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

describe("getMemberStatement", () => {
  it("excludes a refunded line from the taxable subtotal, matching the invoice total", async () => {
    const taxRateBps = 900;
    const lineItems = [
      { quantity: 1, unitAmountCents: 10_000 },
      { quantity: 1, unitAmountCents: 5_000, refunded: true },
    ];
    const totals = computeInvoiceTotals(lineItems, taxRateBps);
    expect(totals.totalCents).toBe(10_900);

    const repos = createInMemoryRepositories(
      baseSeed({
        invoices: [
          {
            id: "inv1",
            studioId: "s1",
            memberId: "m1",
            number: "INV-2026-0001",
            status: "open",
            currency: "EUR",
            taxRateBps,
            subtotalCents: totals.subtotalCents,
            taxCents: totals.taxCents,
            totalCents: totals.totalCents,
            issuedAt: ISO,
            dueAt: null,
            paidAt: null,
            createdAt: ISO,
          },
        ],
        lineItems: [
          {
            id: "li1",
            invoiceId: "inv1",
            description: "Billable",
            quantity: 1,
            unitAmountCents: 10_000,
            amountCents: 10_000,
            refunded: false,
            bookingId: null,
          },
          {
            id: "li2",
            invoiceId: "inv1",
            description: "Refunded",
            quantity: 1,
            unitAmountCents: 5_000,
            amountCents: 5_000,
            refunded: true,
            bookingId: null,
          },
        ],
      }),
    );

    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].totalCents).toBe(10_900);
    expect(statement.lines[0].totalCents).not.toBe(16_350);

    const invoice = await repos.invoices.getById("inv1");
    expect(statement.lines[0].totalCents).toBe(invoice?.totalCents);
    expect(statement.balanceCents).toBe(10_900);
  });

  it("is unchanged for an invoice with no refunded lines", async () => {
    const taxRateBps = 900;
    const lineItems = [{ quantity: 2, unitAmountCents: 1_000 }];
    const totals = computeInvoiceTotals(lineItems, taxRateBps);

    const repos = createInMemoryRepositories(
      baseSeed({
        invoices: [
          {
            id: "inv1",
            studioId: "s1",
            memberId: "m1",
            number: "INV-2026-0001",
            status: "open",
            currency: "EUR",
            taxRateBps,
            subtotalCents: totals.subtotalCents,
            taxCents: totals.taxCents,
            totalCents: totals.totalCents,
            issuedAt: ISO,
            dueAt: null,
            paidAt: null,
            createdAt: ISO,
          },
        ],
        lineItems: [
          {
            id: "li1",
            invoiceId: "inv1",
            description: "Pass",
            quantity: 2,
            unitAmountCents: 1_000,
            amountCents: 2_000,
            refunded: false,
            bookingId: null,
          },
        ],
      }),
    );

    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines[0].totalCents).toBe(totals.totalCents);
    expect(statement.balanceCents).toBe(totals.totalCents);
  });
});
