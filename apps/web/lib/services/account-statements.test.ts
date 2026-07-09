import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice, InvoiceLineItem } from "@/lib/db/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
import { getMemberStatement } from "./account-statements";

const ISO = "2026-03-01T00:00:00.000Z";
const STUDIO_ID = "s1";
const MEMBER_ID = "m1";

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: STUDIO_ID, name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO },
    settings: {
      studioId: STUDIO_ID,
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
        id: MEMBER_ID,
        studioId: STUDIO_ID,
        name: "Member One",
        email: "m1@e.co",
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

function invoice(id: string, over: Partial<Invoice> = {}): Invoice {
  return {
    id,
    studioId: STUDIO_ID,
    memberId: MEMBER_ID,
    number: `INV-2026-${id}`,
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
  };
}

function lineItem(
  id: string,
  invoiceId: string,
  over: Partial<InvoiceLineItem> = {},
): InvoiceLineItem {
  return {
    id,
    invoiceId,
    description: "Line",
    quantity: 1,
    unitAmountCents: 0,
    amountCents: 0,
    refunded: false,
    bookingId: null,
    ...over,
  };
}

describe("getMemberStatement", () => {
  let repos: Repositories;

  beforeEach(async () => {
    repos = createInMemoryRepositories(baseSeed());
  });

  it("excludes a refunded line from the taxable subtotal, matching computeInvoiceTotals", async () => {
    await repos.invoices.insert(invoice("inv1"));
    await repos.invoiceLineItems.insertMany([
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
    ]);

    const statement = await getMemberStatement(repos, STUDIO_ID, MEMBER_ID);

    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].totalCents).toBe(10_900);
    expect(statement.balanceCents).toBe(10_900);

    const canonical = computeInvoiceTotals(
      [
        { quantity: 1, unitAmountCents: 10_000 },
        { quantity: 1, unitAmountCents: 5_000, refunded: true },
      ],
      900,
    );
    expect(statement.lines[0].totalCents).toBe(canonical.totalCents);
    expect(statement.lines[0].totalCents).not.toBe(16_350);
  });

  it("is unaffected for an invoice with no refunded lines", async () => {
    await repos.invoices.insert(invoice("inv1"));
    await repos.invoiceLineItems.insertMany([
      lineItem("li1", "inv1", {
        description: "Pass",
        quantity: 2,
        unitAmountCents: 1_000,
        amountCents: 2_000,
      }),
    ]);

    const statement = await getMemberStatement(repos, STUDIO_ID, MEMBER_ID);

    expect(statement.lines[0].totalCents).toBe(2_180);
    expect(statement.balanceCents).toBe(2_180);
  });

  it("sums each invoice's own computeInvoiceTotals-derived total across the statement", async () => {
    await repos.invoices.insert(invoice("inv1", { number: "INV-2026-0001" }));
    await repos.invoices.insert(invoice("inv2", { number: "INV-2026-0002" }));
    await repos.invoiceLineItems.insertMany([
      lineItem("li1", "inv1", { quantity: 1, unitAmountCents: 10_000, amountCents: 10_000 }),
      lineItem("li2", "inv1", {
        quantity: 1,
        unitAmountCents: 5_000,
        amountCents: 5_000,
        refunded: true,
      }),
    ]);
    await repos.invoiceLineItems.insertMany([
      lineItem("li3", "inv2", { quantity: 3, unitAmountCents: 2_000, amountCents: 6_000 }),
    ]);

    const statement = await getMemberStatement(repos, STUDIO_ID, MEMBER_ID);

    expect(statement.lines).toHaveLength(2);
    const total1 = statement.lines.find((line) => line.invoiceId === "inv1")?.totalCents;
    const total2 = statement.lines.find((line) => line.invoiceId === "inv2")?.totalCents;
    expect(total1).toBe(10_900);
    expect(total2).toBe(6_540);
    expect(statement.balanceCents).toBe((total1 ?? 0) + (total2 ?? 0));
  });
});
