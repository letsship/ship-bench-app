import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice, InvoiceLineItem } from "@/lib/db/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { getMemberStatement } from "./account-statements";
import { createInvoice } from "./invoices";

const NOW = new Date().toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: NOW },
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
        name: "Ada",
        email: "ada@e.co",
        phone: null,
        status: "active",
        notificationsOptedOut: false,
        createdAt: NOW,
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

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: "inv1",
  studioId: "s1",
  memberId: "m1",
  number: "INV-2026-0001",
  status: "open",
  currency: "EUR",
  taxRateBps: 900,
  subtotalCents: 10_000,
  taxCents: 900,
  totalCents: 10_900,
  issuedAt: NOW,
  dueAt: null,
  paidAt: null,
  createdAt: NOW,
  ...over,
});

const lineItem = (id: string, over: Partial<InvoiceLineItem> = {}): InvoiceLineItem => ({
  id,
  invoiceId: "inv1",
  description: id,
  quantity: 1,
  unitAmountCents: 10_000,
  amountCents: 10_000,
  refunded: false,
  bookingId: null,
  ...over,
});

describe("account statements", () => {
  let repos: Repositories;
  beforeEach(() => {
    repos = createInMemoryRepositories(
      baseSeed({
        invoices: [invoice()],
        lineItems: [
          lineItem("li1"),
          lineItem("li2", { unitAmountCents: 5000, amountCents: 5000, refunded: true }),
        ],
      }),
    );
  });

  it("excludes refunded lines from the taxable subtotal", async () => {
    const items = await repos.invoiceLineItems.listByInvoice("inv1");
    const canonical = computeInvoiceTotals(items, 900);
    const statement = await getMemberStatement(repos, "s1", "m1");
    // €100 billable + €50 refunded @ 9% → €109.00, not the over-taxed €163.50.
    expect(statement.lines).toEqual([{ invoiceId: "inv1", number: "INV-2026-0001", totalCents: 10_900 }]);
    expect(statement.lines[0].totalCents).toBe(canonical.totalCents);
    expect(statement.balanceCents).toBe(10_900);
  });

  it("matches the stored invoice total", async () => {
    const stored = await repos.invoices.getById("inv1");
    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines[0].totalCents).toBe(stored?.totalCents);
  });

  it("is unchanged for invoices without refunded lines", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        invoices: [invoice({ subtotalCents: 15_000, taxCents: 1350, totalCents: 16_350 })],
        lineItems: [lineItem("li1"), lineItem("li2", { unitAmountCents: 5000, amountCents: 5000 })],
      }),
    );
    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines[0].totalCents).toBe(16_350);
    expect(statement.balanceCents).toBe(16_350);
  });

  it("statement agrees with a freshly created invoice", async () => {
    const provider = createFakeProvider();
    const detail = await createInvoice(repos, provider, "s1", {
      memberId: "m1",
      lineItems: [{ description: "Pass", quantity: 2, unitAmountCents: 1000 }],
    });
    const statement = await getMemberStatement(repos, "s1", "m1");
    const created = statement.lines.find((line) => line.invoiceId === detail.invoice.id);
    expect(created?.totalCents).toBe(detail.invoice.totalCents);
  });
});
