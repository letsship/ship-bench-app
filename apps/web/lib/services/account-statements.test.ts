import { describe, expect, it } from "vitest";
import { computeInvoiceTotals } from "@/lib/domain/invoices";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import type { Invoice, InvoiceLineItem } from "@/lib/db/types";
import { getMemberStatement } from "./account-statements";

const ISO = new Date().toISOString();

const baseSeed = (): SeedData => ({
  studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO },
  settings: {
    studioId: "s1",
    currency: "EUR",
    taxRateBps: 900, // 9%
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
});

describe("account-statements service", () => {
  describe("getMemberStatement", () => {
    it("correctly excludes refunded lines from taxable subtotal", async () => {
      // Worked example: €100 billable + €50 refunded at 9% tax
      // Should produce €109.00 (10900 cents), not €163.50 (16350 cents)
      const memberId = "m1";
      const invoiceId = "inv1";
      const invoice: Invoice = {
        id: invoiceId,
        studioId: "s1",
        memberId,
        number: "INV-2026-0001",
        status: "open",
        currency: "EUR",
        taxRateBps: 900,
        subtotalCents: 10000, // €100
        taxCents: 900, // €9 tax on €100
        totalCents: 10900, // €109
        issuedAt: ISO,
        dueAt: null,
        paidAt: null,
        createdAt: ISO,
      };

      const lineItems: InvoiceLineItem[] = [
        {
          id: "li1",
          invoiceId,
          description: "Billable service",
          quantity: 1,
          unitAmountCents: 10000, // €100
          amountCents: 10000,
          refunded: false,
          bookingId: null,
        },
        {
          id: "li2",
          invoiceId,
          description: "Refunded service",
          quantity: 1,
          unitAmountCents: 5000, // €50
          amountCents: 5000,
          refunded: true,
          bookingId: null,
        },
      ];

      const repos = createInMemoryRepositories({
        ...baseSeed(),
        members: [
          {
            id: memberId,
            studioId: "s1",
            name: "Test Member",
            email: "test@example.com",
            phone: null,
            status: "active",
            notificationsOptedOut: false,
            createdAt: ISO,
          },
        ],
        invoices: [invoice],
        lineItems,
      });

      const statement = await getMemberStatement(repos, "s1", memberId);

      // Verify the statement total matches computeInvoiceTotals
      const expectedTotals = computeInvoiceTotals(lineItems, 900);
      expect(expectedTotals.totalCents).toBe(10900); // €109

      expect(statement.lines).toHaveLength(1);
      expect(statement.lines[0]).toEqual({
        invoiceId,
        number: "INV-2026-0001",
        totalCents: 10900, // NOT 16350!
      });

      // Verify it matches the stored invoice total
      expect(statement.lines[0].totalCents).toBe(invoice.totalCents);

      // Verify balance calculation
      expect(statement.balanceCents).toBe(10900);
    });

    it("handles invoices without refunded lines (no regression)", async () => {
      // Regression test: ensure invoices without refunds still work correctly
      const memberId = "m2";
      const invoiceId = "inv2";
      const invoice: Invoice = {
        id: invoiceId,
        studioId: "s1",
        memberId,
        number: "INV-2026-0002",
        status: "open",
        currency: "EUR",
        taxRateBps: 900,
        subtotalCents: 5000, // €50
        taxCents: 450, // €4.50 tax on €50
        totalCents: 5450, // €54.50
        issuedAt: ISO,
        dueAt: null,
        paidAt: null,
        createdAt: ISO,
      };

      const lineItems: InvoiceLineItem[] = [
        {
          id: "li3",
          invoiceId,
          description: "Service",
          quantity: 1,
          unitAmountCents: 5000, // €50
          amountCents: 5000,
          refunded: false,
          bookingId: null,
        },
      ];

      const repos = createInMemoryRepositories({
        ...baseSeed(),
        members: [
          {
            id: memberId,
            studioId: "s1",
            name: "Test Member 2",
            email: "test2@example.com",
            phone: null,
            status: "active",
            notificationsOptedOut: false,
            createdAt: ISO,
          },
        ],
        invoices: [invoice],
        lineItems,
      });

      const statement = await getMemberStatement(repos, "s1", memberId);

      const expectedTotals = computeInvoiceTotals(lineItems, 900);
      expect(expectedTotals.totalCents).toBe(5450);

      expect(statement.lines).toHaveLength(1);
      expect(statement.lines[0].totalCents).toBe(5450);
      expect(statement.lines[0].totalCents).toBe(invoice.totalCents);
      expect(statement.balanceCents).toBe(5450);
    });

    it("accumulates balance across multiple invoices", async () => {
      // Test that balance is the sum of all invoice totals
      const memberId = "m3";

      const invoices: Invoice[] = [
        {
          id: "inv3",
          studioId: "s1",
          memberId,
          number: "INV-2026-0003",
          status: "open",
          currency: "EUR",
          taxRateBps: 900,
          subtotalCents: 1000,
          taxCents: 90,
          totalCents: 1090,
          issuedAt: ISO,
          dueAt: null,
          paidAt: null,
          createdAt: ISO,
        },
        {
          id: "inv4",
          studioId: "s1",
          memberId,
          number: "INV-2026-0004",
          status: "open",
          currency: "EUR",
          taxRateBps: 900,
          subtotalCents: 2000,
          taxCents: 180,
          totalCents: 2180,
          issuedAt: ISO,
          dueAt: null,
          paidAt: null,
          createdAt: ISO,
        },
      ];

      const lineItems: InvoiceLineItem[] = [
        {
          id: "inv3-li",
          invoiceId: "inv3",
          description: "Item",
          quantity: 1,
          unitAmountCents: 1000,
          amountCents: 1000,
          refunded: false,
          bookingId: null,
        },
        {
          id: "inv4-li",
          invoiceId: "inv4",
          description: "Item",
          quantity: 1,
          unitAmountCents: 2000,
          amountCents: 2000,
          refunded: false,
          bookingId: null,
        },
      ];

      const repos = createInMemoryRepositories({
        ...baseSeed(),
        members: [
          {
            id: memberId,
            studioId: "s1",
            name: "Test Member 3",
            email: "test3@example.com",
            phone: null,
            status: "active",
            notificationsOptedOut: false,
            createdAt: ISO,
          },
        ],
        invoices,
        lineItems,
      });

      const statement = await getMemberStatement(repos, "s1", memberId);

      expect(statement.lines).toHaveLength(2);
      expect(statement.balanceCents).toBe(1090 + 2180); // 3270
    });
  });
});
