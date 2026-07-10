import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPackage, Member } from "@/lib/db/types";
import {
  purchasePackage,
  listMemberPackages,
  refundPackage,
  spendCreditForBooking,
} from "./packages";

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
    classPackages: [],
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

const pack = (id: string, memberId: string, over: Partial<ClassPackage> = {}): ClassPackage => ({
  id,
  studioId: "s1",
  memberId,
  creditsTotal: 10,
  creditsRemaining: 10,
  priceCents: 10000,
  status: "active",
  purchasedAt: ISO,
  ...over,
});

describe("packages service", () => {
  let repos: Repositories;
  beforeEach(() => {
    repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
  });

  it("purchases a pack with the right total/remaining/price/status", async () => {
    const purchased = await purchasePackage(repos, { memberId: "m1", credits: 5 });
    expect(purchased).toMatchObject({
      memberId: "m1",
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
    });
    expect(purchased.purchasedAt).toBeTruthy();
  });

  it("404s purchasing a pack for an unknown member", async () => {
    await expect(purchasePackage(repos, { memberId: "nope", credits: 5 })).rejects.toMatchObject({
      status: 404,
    });
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
    const list = await listMemberPackages(repos, "m1");
    expect(list.map((p) => p.id)).toEqual(["newer", "older"]);
  });

  it("refunding zeroes credits and flips status", async () => {
    repos = createInMemoryRepositories(
      baseSeed({ members: [member("m1")], classPackages: [pack("p1", "m1")] }),
    );
    const refunded = await refundPackage(repos, "p1");
    expect(refunded).toMatchObject({ creditsRemaining: 0, status: "refunded" });
  });

  it("spendCreditForBooking returns null for a member with no packs", async () => {
    const result = await spendCreditForBooking(repos, "m1");
    expect(result).toBeNull();
  });

  it("spendCreditForBooking decrements the oldest eligible pack when several exist", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        classPackages: [
          pack("newer", "m1", { purchasedAt: "2026-02-01T00:00:00.000Z" }),
          pack("older", "m1", { purchasedAt: "2026-01-01T00:00:00.000Z" }),
        ],
      }),
    );
    const spent = await spendCreditForBooking(repos, "m1");
    expect(spent?.id).toBe("older");
    expect(spent?.creditsRemaining).toBe(9);
    expect((await repos.classPackages.getById("newer"))?.creditsRemaining).toBe(10);
  });

  it("spendCreditForBooking throws 402 pack_exhausted when every pack is exhausted or refunded", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        classPackages: [
          pack("exhausted", "m1", { creditsRemaining: 0 }),
          pack("refunded", "m1", { status: "refunded", creditsRemaining: 0 }),
        ],
      }),
    );
    await expect(spendCreditForBooking(repos, "m1")).rejects.toMatchObject({
      status: 402,
      code: "pack_exhausted",
    });
  });
});
