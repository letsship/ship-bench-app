import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createBooking } from "./bookings";
import { createPackage, drawCreditForMember, listPackages, refundPackage } from "./packages";

const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

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

const classType = (id: string): ClassType => ({
  id,
  studioId: "s1",
  name: "Yoga",
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: ISO,
});

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
  id,
  studioId: "s1",
  classTypeId: "ct1",
  instructor: "Instructor",
  startsAt: FUTURE,
  endsAt: FUTURE_END,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
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

  describe("booking integration", () => {
    it("decrements the oldest pack's creditsRemaining by one on booking (criterion 3)", async () => {
      const m = member("m1");
      const ct = classType("ct1");
      const sess = session("s1");
      const olderPack: ClassPack = {
        id: "pack1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 3,
        priceCents: 5000,
        status: "active",
        purchasedAt: "2024-01-01T10:00:00Z",
      };
      const newerPack: ClassPack = {
        id: "pack2",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 10,
        creditsRemaining: 5,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2024-01-02T10:00:00Z",
      };
      repos = createInMemoryRepositories(
        baseSeed({
          members: [m],
          classTypes: [ct],
          sessions: [sess],
          classPacks: [newerPack, olderPack],
        }),
      );

      const provider = createFakeProvider();
      await createBooking(repos, provider, { sessionId: "s1", memberId: "m1" });

      // The oldest pack (pack1) should have creditsRemaining decremented by 1
      const updatedOldPack = await repos.classPacks.getById("pack1");
      expect(updatedOldPack?.creditsRemaining).toBe(2);
      // The newer pack should be untouched
      const updatedNewPack = await repos.classPacks.getById("pack2");
      expect(updatedNewPack?.creditsRemaining).toBe(5);
    });

    it("rejects with 402 pack_exhausted when member's packs are exhausted (criterion 4)", async () => {
      const m = member("m1");
      const ct = classType("ct1");
      const sess = session("s1");
      const exhaustedPack: ClassPack = {
        id: "pack1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 0,
        priceCents: 5000,
        status: "active",
        purchasedAt: ISO,
      };
      repos = createInMemoryRepositories(
        baseSeed({
          members: [m],
          classTypes: [ct],
          sessions: [sess],
          classPacks: [exhaustedPack],
        }),
      );

      const provider = createFakeProvider();

      // Attempt to book should throw 402 pack_exhausted
      try {
        await createBooking(repos, provider, { sessionId: "s1", memberId: "m1" });
        throw new Error("Should have thrown pack_exhausted");
      } catch (error) {
        expect(error).toHaveProperty("status", 402);
        expect(error).toHaveProperty("code", "pack_exhausted");
      }

      // Verify no booking was inserted
      const bookings = await repos.bookings.listBySession("s1");
      expect(bookings).toHaveLength(0);
    });

    it("rejects repeated same-session booking with 409 before drawing credit (criterion 5)", async () => {
      const m = member("m1");
      const ct = classType("ct1");
      const sess = session("s1");
      const pack: ClassPack = {
        id: "pack1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 5,
        priceCents: 5000,
        status: "active",
        purchasedAt: ISO,
      };
      repos = createInMemoryRepositories(
        baseSeed({
          members: [m],
          classTypes: [ct],
          sessions: [sess],
          classPacks: [pack],
        }),
      );

      const provider = createFakeProvider();

      // First booking succeeds and draws a credit
      await createBooking(repos, provider, { sessionId: "s1", memberId: "m1" });
      let packState = await repos.classPacks.getById("pack1");
      expect(packState?.creditsRemaining).toBe(4);

      // Second booking of same session should fail with 409 and spend no credit
      try {
        await createBooking(repos, provider, { sessionId: "s1", memberId: "m1" });
        throw new Error("Should have thrown already_booked");
      } catch (error) {
        expect(error).toHaveProperty("status", 409);
        expect(error).toHaveProperty("code", "booking_already_booked");
      }

      // Pack should still have 4 credits (no extra credit drawn)
      packState = await repos.classPacks.getById("pack1");
      expect(packState?.creditsRemaining).toBe(4);
    });
  });
});
