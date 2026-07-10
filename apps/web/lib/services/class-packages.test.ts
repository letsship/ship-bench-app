import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPackage } from "@/lib/db/types";
import {
  drawCreditForBooking,
  listMemberPackages,
  purchasePackage,
  refundPackage,
} from "./class-packages";

const ISO = "2026-03-01T00:00:00.000Z";

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
    classPackages: [],
    outbox: [],
    ...over,
  };
}

const classPackage = (id: string, over: Partial<ClassPackage> = {}): ClassPackage => ({
  id,
  studioId: "s1",
  memberId: "m1",
  creditsTotal: 5,
  creditsRemaining: 5,
  priceCents: 1000,
  status: "active",
  purchasedAt: ISO,
  ...over,
});

describe("purchasePackage", () => {
  it("creates an active pack with creditsRemaining = credits and the flat per-credit price", async () => {
    const repos = createInMemoryRepositories(baseSeed());
    const pack = await purchasePackage(repos, "s1", { memberId: "m1", credits: 10 });
    expect(pack).toMatchObject({
      memberId: "m1",
      creditsTotal: 10,
      creditsRemaining: 10,
      priceCents: 1000,
      status: "active",
    });
    expect(pack.id).toBeTruthy();
    expect(pack.purchasedAt).toBeTruthy();
  });
});

describe("listMemberPackages", () => {
  it("returns a member's packs newest first", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classPackages: [
          classPackage("older", { purchasedAt: "2026-01-01T00:00:00.000Z" }),
          classPackage("newer", { purchasedAt: "2026-02-01T00:00:00.000Z" }),
        ],
      }),
    );
    const packs = await listMemberPackages(repos, "m1");
    expect(packs.map((p) => p.id)).toEqual(["newer", "older"]);
  });
});

describe("refundPackage", () => {
  it("zeroes creditsRemaining and flips status to refunded", async () => {
    const repos = createInMemoryRepositories(baseSeed({ classPackages: [classPackage("p1")] }));
    const refunded = await refundPackage(repos, "p1");
    expect(refunded.creditsRemaining).toBe(0);
    expect(refunded.status).toBe("refunded");
  });

  it("404s for an unknown pack", async () => {
    const repos = createInMemoryRepositories(baseSeed());
    await expect(refundPackage(repos, "nope")).rejects.toMatchObject({ status: 404 });
  });

  it("excludes a refunded pack from drawCreditForBooking", async () => {
    const repos = createInMemoryRepositories(baseSeed({ classPackages: [classPackage("p1")] }));
    await refundPackage(repos, "p1");
    await expect(drawCreditForBooking(repos, "m1")).rejects.toMatchObject({
      status: 402,
      code: "pack_exhausted",
    });
  });
});

describe("drawCreditForBooking", () => {
  it("is a no-op for a member who never bought a pack", async () => {
    const repos = createInMemoryRepositories(baseSeed());
    await expect(drawCreditForBooking(repos, "m1")).resolves.toEqual({
      spent: false,
      packId: null,
    });
  });

  it("throws 402 pack_exhausted when every owned pack is used up", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({ classPackages: [classPackage("p1", { creditsRemaining: 0 })] }),
    );
    await expect(drawCreditForBooking(repos, "m1")).rejects.toMatchObject({
      status: 402,
      code: "pack_exhausted",
    });
  });

  it("spends one credit from the oldest eligible pack", async () => {
    const repos: Repositories = createInMemoryRepositories(
      baseSeed({
        classPackages: [
          classPackage("newer", { purchasedAt: "2026-02-01T00:00:00.000Z", creditsRemaining: 5 }),
          classPackage("older", { purchasedAt: "2026-01-01T00:00:00.000Z", creditsRemaining: 3 }),
        ],
      }),
    );
    const draw = await drawCreditForBooking(repos, "m1");
    expect(draw).toEqual({ spent: true, packId: "older" });
    const older = await repos.classPackages.getById("older");
    const newer = await repos.classPackages.getById("newer");
    expect(older?.creditsRemaining).toBe(2);
    expect(newer?.creditsRemaining).toBe(5);
  });
});
