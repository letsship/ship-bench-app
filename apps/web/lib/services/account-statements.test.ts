import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Member } from "@/lib/db/types";
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

describe("account statements service", () => {
  let repos: Repositories;
  let studioId: string;
  let memberId: string;

  beforeEach(async () => {
    const memberId_ = "m1";
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member(memberId_)],
        invoices: [
          {
            id: "inv1",
            studioId: "s1",
            memberId: memberId_,
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
          },
        ],
        lineItems: [
          {
            id: "li1",
            invoiceId: "inv1",
            description: "Billable",
            quantity: 1,
            unitAmountCents: 10000,
            amountCents: 10000,
            refunded: false,
            bookingId: null,
          },
          {
            id: "li2",
            invoiceId: "inv1",
            description: "Refunded",
            quantity: 1,
            unitAmountCents: 5000,
            amountCents: 5000,
            refunded: true,
            bookingId: null,
          },
        ],
      }),
    );
    studioId = "s1";
    memberId = memberId_;
  });

  it("computes statement total excluding refunded lines from the taxable subtotal", async () => {
    // €100 billable + €50 refunded at 9% tax should give €109.00 (10900 cents)
    // because tax applies only to the €100 non-refunded portion, not the full €150
    const statement = await getMemberStatement(repos, studioId, memberId);
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0].totalCents).toBe(10900);
    expect(statement.lines[0].invoiceId).toBe("inv1");
  });

  it("aggregates balance from all invoices", async () => {
    const statement = await getMemberStatement(repos, studioId, memberId);
    expect(statement.balanceCents).toBe(10900);
  });
});
