import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Invoice, InvoiceLineItem, Member, Studio, StudioSettings } from "@/lib/db/types";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
import { getMemberStatement } from "./account-statements";

const NOW = new Date("2026-07-29T00:00:00Z");
const ISO = NOW.toISOString();
const TAX_RATE_BPS = 900; // 9%

function seedWithRefundedLine(): SeedData {
  const studio: Studio = {
    id: "s1",
    name: "S",
    slug: "s",
    timezone: "Europe/Amsterdam",
    createdAt: ISO,
  };
  const settings: StudioSettings = {
    studioId: "s1",
    currency: "EUR",
    taxRateBps: TAX_RATE_BPS,
    cancellationWindowHours: 12,
    waitlistEnabled: true,
    notifyBookingConfirmations: true,
    notifyCancellations: true,
    notifyWaitlistPromotions: true,
    notifyInvoices: true,
  };
  const member: Member = {
    id: "m1",
    studioId: "s1",
    name: "A",
    email: "a@e.co",
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: ISO,
  };
  // €100 billable line + €50 refunded line at 9% tax => €109.00 (10900 cents).
  const invoiceId = "inv1";
  const invoice: Invoice = {
    id: invoiceId,
    studioId: "s1",
    memberId: member.id,
    number: "INV-2026-0001",
    status: "open",
    currency: "EUR",
    taxRateBps: TAX_RATE_BPS,
    subtotalCents: 10000,
    taxCents: 900,
    totalCents: 10900,
    issuedAt: ISO,
    dueAt: null,
    paidAt: null,
    createdAt: ISO,
  };
  const lineItems: InvoiceLineItem[] = [
    {
      id: "li1",
      invoiceId,
      description: "Pass",
      quantity: 1,
      unitAmountCents: 10000,
      amountCents: 10000,
      refunded: false,
      bookingId: null,
    },
    {
      id: "li2",
      invoiceId,
      description: "Refunded",
      quantity: 1,
      unitAmountCents: 5000,
      amountCents: 5000,
      refunded: true,
      bookingId: null,
    },
  ];
  return {
    studio,
    settings,
    members: [member],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [invoice],
    lineItems,
    outbox: [],
  };
}

describe("getMemberStatement", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(seedWithRefundedLine());
  });

  it("excludes refunded lines from the taxable subtotal, matching the canonical total", async () => {
    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines).toHaveLength(1);

    const line = statement.lines[0];
    const items = await repos.invoiceLineItems.listByInvoice(line.invoiceId);
    const invoice = (await repos.invoices.listByStudio("s1")).find((i) => i.id === line.invoiceId)!;
    const canonical = computeInvoiceTotals(items, invoice.taxRateBps);

    expect(canonical.totalCents).toBe(10900);
    expect(line.totalCents).toBe(canonical.totalCents);
    expect(line.totalCents).toBe(invoice.totalCents);
    // Never the over-taxed figure that taxes the refunded line too.
    expect(line.totalCents).not.toBe(16350);
    expect(statement.balanceCents).toBe(10900);
  });

  it("agrees with the stored invoice total for invoices without refunded lines", async () => {
    // Reset to the shared seed (no refunded lines among the paid/open invoices).
    const base = createInMemoryRepositories(buildSeed(NOW));
    const studioId = (await base.studios.getFirst())?.id ?? "";
    const invoices = await base.invoices.listByStudio(studioId);
    const first = invoices[0];
    const statement = await getMemberStatement(base, studioId, first.memberId);
    const matching = statement.lines.find((l) => l.invoiceId === first.id);
    expect(matching?.totalCents).toBe(first.totalCents);
  });
});
