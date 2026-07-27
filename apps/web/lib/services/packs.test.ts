import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Member } from "@/lib/db/types";
import { buyPack, listPacks, refundPack } from "./packs";

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
    invoices: [],
    lineItems: [],
    outbox: [],
    classPacks: [],
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

describe("packs service", () => {
  let repos: Repositories;
  beforeEach(() => {
    repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
  });

  it("buys a 5-credit pack with priceCents 5000", async () => {
    const pack = await buyPack(repos, "s1", { memberId: "m1", credits: 5 });
    expect(pack).toMatchObject({
      memberId: "m1",
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
    });
    expect(pack.id).toBeTruthy();
    expect(pack.purchasedAt).toBeTruthy();
  });

  it("buys a 10-credit pack with priceCents 10000", async () => {
    const pack = await buyPack(repos, "s1", { memberId: "m1", credits: 10 });
    expect(pack).toMatchObject({
      creditsTotal: 10,
      creditsRemaining: 10,
      priceCents: 10000,
    });
  });

  it("rejects an unknown member with 404", async () => {
    await expect(buyPack(repos, "s1", { memberId: "nope", credits: 5 })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("lists a member's packs newest first with the AC fields", async () => {
    await repos.classPacks.insert({
      id: "p1",
      studioId: "s1",
      memberId: "m1",
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
      purchasedAt: "2026-01-01T00:00:00.000Z",
    });
    await repos.classPacks.insert({
      id: "p2",
      studioId: "s1",
      memberId: "m1",
      creditsTotal: 10,
      creditsRemaining: 10,
      priceCents: 10000,
      status: "active",
      purchasedAt: "2026-02-01T00:00:00.000Z",
    });
    const list = await listPacks(repos, "m1");
    expect(list.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(Object.keys(list[0]).sort()).toEqual(
      ["id", "creditsTotal", "creditsRemaining", "priceCents", "status", "purchasedAt"].sort(),
    );
  });

  it("refunds a pack, voiding remaining credits", async () => {
    const pack = await buyPack(repos, "s1", { memberId: "m1", credits: 5 });
    const refunded = await refundPack(repos, pack.id);
    expect(refunded.creditsRemaining).toBe(0);
    expect(refunded.status).toBe("refunded");
  });
});
