import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice, InvoiceLineItem } from "@/lib/db/types";
import { getMemberStatement } from "./account-statements";
import { computeInvoiceTotals } from "@/lib/domain/invoices";

const NOW = new Date().toISOString();

describe("getMemberStatement", () => {
  function baseRepos(): Repositories {
    return createInMemoryRepositories({
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
          name: "M1",
          email: "m1@e.co",
          phone: null,
          status: "active",
          notificationsOptedOut: false,
          createdAt: NOW,
        },
      ],
      invoices: [],
      lineItems: [],
      classTypes: [],
      sessions: [],
      bookings: [],
      outbox: [],
    });
  }

  it("excludes refunded lines from the taxable subtotal — equals the domain function", async () => {
    const repos = baseRepos();
    // Insert one invoice with one billable line (€100) and one refunded line (€50).
    const invoice: Invoice = {
      id: "inv1",
      studioId: "s1",
      memberId: "m1",
      number: "INV-2026-0001",
      status: "open",
      currency: "EUR",
      taxRateBps: 900,
      subtotalCents: 10000,
      taxCents: 900,
      totalCents: 10900,
      issuedAt: NOW,
      dueAt: null,
      paidAt: null,
      createdAt: NOW,
    };
    const lineItems: InvoiceLineItem[] = [
      {
        id: "li1",
        invoiceId: "inv1",
        description: "Pass",
        quantity: 1,
        unitAmountCents: 10000,
        amountCents: 10000,
        refunded: false,
        bookingId: null,
      },
      {
        id: "li2",
        invoiceId: "inv1",
        description: "Refunded pass",
        quantity: 1,
        unitAmountCents: 5000,
        amountCents: 5000,
        refunded: true,
        bookingId: null,
      },
    ];
    await repos.invoices.insert(invoice);
    await repos.invoiceLineItems.insertMany(lineItems);

    // Compute canonical total from the domain function directly.
    const canonical = computeInvoiceTotals(lineItems, invoice.taxRateBps);

    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines).toHaveLength(1);
    // The statement total should match the canonical total (10900 = 10000 + 900 tax),
    // NOT the over-taxed 16350 (tax on all 15000).
    expect(statement.lines[0].totalCents).toBe(canonical.totalCents);
    expect(statement.lines[0].totalCents).toBe(10900);
    // The statement balance equals the line total.
    expect(statement.balanceCents).toBe(10900);
  });

  it("matches canonical total for invoices without refunded lines", async () => {
    const repos = baseRepos();
    const invoice: Invoice = {
      id: "inv1",
      studioId: "s1",
      memberId: "m1",
      number: "INV-2026-0001",
      status: "open",
      currency: "EUR",
      taxRateBps: 900,
      subtotalCents: 2000,
      taxCents: 180,
      totalCents: 2180,
      issuedAt: NOW,
      dueAt: null,
      paidAt: null,
      createdAt: NOW,
    };
    const lineItems: InvoiceLineItem[] = [
      {
        id: "li1",
        invoiceId: "inv1",
        description: "Pass",
        quantity: 2,
        unitAmountCents: 1000,
        amountCents: 2000,
        refunded: false,
        bookingId: null,
      },
    ];
    await repos.invoices.insert(invoice);
    await repos.invoiceLineItems.insertMany(lineItems);

    const canonical = computeInvoiceTotals(lineItems, invoice.taxRateBps);
    const statement = await getMemberStatement(repos, "s1", "m1");
    expect(statement.lines[0].totalCents).toBe(canonical.totalCents);
    expect(statement.lines[0].totalCents).toBe(2180);
  });
});