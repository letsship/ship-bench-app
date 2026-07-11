import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPackage, Member } from "@/lib/db/types";
import { listPackagesForMember, purchasePackage, refundPackage } from "./packages";

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
    classPackages: [],
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

const pack = (id: string, memberId: string, over: Partial<ClassPackage> = {}): ClassPackage => ({
  id,
  studioId: "s1",
  memberId,
  creditsTotal: 5,
  creditsRemaining: 5,
  priceCents: 5000,
  status: "active",
  purchasedAt: ISO,
  ...over,
});

describe("packages service", () => {
  let repos: Repositories;
  beforeEach(() => {
    repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
  });

  it("purchases a 5-credit pack at 5000 cents", async () => {
    const created = await purchasePackage(repos, "s1", { memberId: "m1", credits: 5 });
    expect(created.creditsTotal).toBe(5);
    expect(created.creditsRemaining).toBe(5);
    expect(created.priceCents).toBe(5000);
    expect(created.status).toBe("active");
  });

  it("purchases a 10-credit pack at 10000 cents", async () => {
    const created = await purchasePackage(repos, "s1", { memberId: "m1", credits: 10 });
    expect(created.creditsTotal).toBe(10);
    expect(created.priceCents).toBe(10000);
  });

  it("rejects an unknown or foreign member with 400", async () => {
    await expect(
      purchasePackage(repos, "s1", { memberId: "nope", credits: 5 }),
    ).rejects.toMatchObject({ status: 400 });

    const otherStudioRepos = createInMemoryRepositories(
      baseSeed({
        studio: { id: "s2", name: "S2", slug: "s2", timezone: "UTC", createdAt: ISO },
        settings: {
          studioId: "s2",
          currency: "EUR",
          taxRateBps: 0,
          cancellationWindowHours: 12,
          waitlistEnabled: true,
          notifyBookingConfirmations: true,
          notifyCancellations: true,
          notifyWaitlistPromotions: true,
          notifyInvoices: true,
        },
        members: [member("m1", { studioId: "s2" })],
      }),
    );
    await expect(
      purchasePackage(otherStudioRepos, "s1", { memberId: "m1", credits: 5 }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("lists a member's packs newest first", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        classPackages: [
          pack("older", "m1", { purchasedAt: "2026-01-01T00:00:00.000Z" }),
          pack("newer", "m1", { purchasedAt: "2026-02-01T00:00:00.000Z" }),
        ],
      }),
    );
    const list = await listPackagesForMember(repos, "m1");
    expect(list.map((p) => p.id)).toEqual(["newer", "older"]);
  });

  it("refunds a pack: zeroes creditsRemaining and flips status", async () => {
    repos = createInMemoryRepositories(
      baseSeed({ members: [member("m1")], classPackages: [pack("p1", "m1")] }),
    );
    const refunded = await refundPackage(repos, "p1");
    expect(refunded.creditsRemaining).toBe(0);
    expect(refunded.status).toBe("refunded");
  });

  it("404s refunding an unknown pack", async () => {
    await expect(refundPackage(repos, "nope")).rejects.toMatchObject({ status: 404 });
  });
});
