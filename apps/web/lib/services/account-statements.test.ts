import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice, InvoiceLineItem, Member } from "@/lib/db/types";
import { getMemberStatement } from "./account-statements";

const ISO = new Date().toISOString();

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

const member = (id: string, over: Partial<Member> = {}): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
  ...over,
});

const invoice = (id: string, memberId: string, over: Partial<Invoice> = {}): Invoice => ({
  id,
  studioId: "s1",
  memberId,
  number: "INV-2026-0001",
  status: "open",
  currency: "EUR",
  taxRateBps: 900,
  subtotalCents: 10000,
  taxCents: 900,
  totalCents: 10900,
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
  description: "Item",
  quantity: 1,
  unitAmountCents: 1000,
  amountCents: 1000,
  refunded: false,
  bookingId: null,
  ...over,
});

describe("account statements", () => {
  let repos: Repositories;

  describe("getMemberStatement", () => {
    it("computes statement total from non-refunded line items only", async () => {
      // Invoice with €100 billable + €50 refunded at 9% tax = €109.00 (10900 cents)
      repos = createInMemoryRepositories(
        baseSeed({
          members: [member("m1")],
          invoices: [
            invoice("inv1", "m1", { subtotalCents: 10000, taxCents: 900, totalCents: 10900 }),
          ],
          lineItems: [
            lineItem("li1", "inv1", { quantity: 1, unitAmountCents: 10000, amountCents: 10000 }),
            lineItem("li2", "inv1", {
              quantity: 1,
              unitAmountCents: 5000,
              amountCents: 5000,
              refunded: true,
            }),
          ],
        }),
      );
      const statement = await getMemberStatement(repos, "s1", "m1");
      expect(statement.lines).toHaveLength(1);
      expect(statement.lines[0].totalCents).toBe(10900);
      expect(statement.balanceCents).toBe(10900);
    });

    it("matches stored invoice total when computing from line items with refunds", async () => {
      // Verify that the statement's computed total equals the stored invoice total
      repos = createInMemoryRepositories(
        baseSeed({
          members: [member("m2")],
          invoices: [invoice("inv2", "m2", { totalCents: 10900 })],
          lineItems: [
            lineItem("li3", "inv2", { quantity: 1, unitAmountCents: 10000 }),
            lineItem("li4", "inv2", { quantity: 1, unitAmountCents: 5000, refunded: true }),
          ],
        }),
      );
      const statement = await getMemberStatement(repos, "s1", "m2");
      const storedTotal = (await repos.invoices.getById("inv2"))?.totalCents ?? 0;
      expect(statement.lines[0].totalCents).toBe(storedTotal);
    });

    it("sums multiple invoices in the statement", async () => {
      repos = createInMemoryRepositories(
        baseSeed({
          members: [member("m3")],
          invoices: [
            invoice("inv3", "m3", { totalCents: 2180 }),
            invoice("inv4", "m3", { totalCents: 1090, number: "INV-2026-0002" }),
          ],
          lineItems: [
            lineItem("li5", "inv3", { quantity: 2, unitAmountCents: 1000 }),
            lineItem("li6", "inv4", { quantity: 1, unitAmountCents: 1000 }),
          ],
        }),
      );
      const statement = await getMemberStatement(repos, "s1", "m3");
      expect(statement.lines).toHaveLength(2);
      expect(statement.balanceCents).toBe(3270);
    });
  });
});
