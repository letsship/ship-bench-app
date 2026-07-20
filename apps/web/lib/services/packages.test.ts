import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack, Member } from "@/lib/db/types";
import { createPackage, drawCreditForMember, listPackages, refundPackage } from "./packages";

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
    classPacks: [],
    ...over,
  };
}

const member = (id: string, over: Partial<Member> = {}): Member => ({
  id,
  studioId: "s1",
  name: "Member",
  email: `${id}@example.com`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
  ...over,
});

describe("packages", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(baseSeed({}));
  });

  describe("createPackage", () => {
    it("creates a 5-credit pack", async () => {
      const m = member("m1");
      repos = createInMemoryRepositories(baseSeed({ members: [m] }));

      const pack = await createPackage(repos, "s1", { memberId: "m1", credits: 5 });

      expect(pack.memberId).toBe("m1");
      expect(pack.creditsTotal).toBe(5);
      expect(pack.creditsRemaining).toBe(5);
      expect(pack.priceCents).toBe(5000);
      expect(pack.status).toBe("active");
      expect(pack.purchasedAt).toBeDefined();
    });

    it("creates a 10-credit pack", async () => {
      const m = member("m1");
      repos = createInMemoryRepositories(baseSeed({ members: [m] }));

      const pack = await createPackage(repos, "s1", { memberId: "m1", credits: 10 });

      expect(pack.memberId).toBe("m1");
      expect(pack.creditsTotal).toBe(10);
      expect(pack.creditsRemaining).toBe(10);
      expect(pack.priceCents).toBe(10000);
      expect(pack.status).toBe("active");
    });

    it("throws 404 if member does not exist", async () => {
      await expect(
        createPackage(repos, "s1", { memberId: "nonexistent", credits: 5 }),
      ).rejects.toThrow("Member not found");
    });
  });

  describe("listPackages", () => {
    it("returns member's packs sorted newest first", async () => {
      const m = member("m1");
      const pack1: ClassPack = {
        id: "pack1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 5,
        priceCents: 5000,
        status: "active",
        purchasedAt: "2024-01-01T10:00:00Z",
      };
      const pack2: ClassPack = {
        id: "pack2",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 10,
        creditsRemaining: 10,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2024-01-02T10:00:00Z",
      };
      repos = createInMemoryRepositories(baseSeed({ members: [m], classPacks: [pack1, pack2] }));

      const packs = await listPackages(repos, "m1");

      expect(packs).toHaveLength(2);
      expect(packs[0]).toEqual(pack2);
      expect(packs[1]).toEqual(pack1);
    });
  });

  describe("refundPackage", () => {
    it("sets creditsRemaining to 0 and status to refunded", async () => {
      const pack: ClassPack = {
        id: "pack1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 3,
        priceCents: 5000,
        status: "active",
        purchasedAt: ISO,
      };
      repos = createInMemoryRepositories(baseSeed({ classPacks: [pack] }));

      const refunded = await refundPackage(repos, "pack1");

      expect(refunded.creditsRemaining).toBe(0);
      expect(refunded.status).toBe("refunded");
      expect(refunded.creditsTotal).toBe(5);
    });

    it("throws 404 if pack does not exist", async () => {
      await expect(refundPackage(repos, "nonexistent")).rejects.toThrow("Pack not found");
    });
  });

  describe("drawCreditForMember", () => {
    it("returns the oldest active pack with credits", async () => {
      const older: ClassPack = {
        id: "pack1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 2,
        priceCents: 5000,
        status: "active",
        purchasedAt: "2024-01-01T10:00:00Z",
      };
      const newer: ClassPack = {
        id: "pack2",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 10,
        creditsRemaining: 5,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2024-01-02T10:00:00Z",
      };
      repos = createInMemoryRepositories(baseSeed({ classPacks: [newer, older] }));

      const pack = await drawCreditForMember(repos, "m1");

      expect(pack?.id).toBe("pack1");
    });

    it("returns null if member never purchased", async () => {
      const pack = await drawCreditForMember(repos, "m1");
      expect(pack).toBeNull();
    });

    it("throws 402 pack_exhausted if all packs are exhausted", async () => {
      const exhausted: ClassPack = {
        id: "pack1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 0,
        priceCents: 5000,
        status: "active",
        purchasedAt: ISO,
      };
      repos = createInMemoryRepositories(baseSeed({ classPacks: [exhausted] }));

      try {
        await drawCreditForMember(repos, "m1");
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toHaveProperty("status", 402);
        expect(error).toHaveProperty("code", "pack_exhausted");
      }
    });
  });
});
