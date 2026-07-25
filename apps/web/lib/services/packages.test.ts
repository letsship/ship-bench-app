import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Member, ClassSession, ClassType, ClassPack } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createBooking } from "./bookings";
import { createPackage, listPackages, refundPackage, drawCreditForBooking } from "./packages";

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
    packs: [],
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
  instructor: "I",
  startsAt: FUTURE,
  endsAt: FUTURE_END,
  capacity: 10,
  priceCents: 1000,
  status: "scheduled",
  createdAt: ISO,
  ...over,
});

const pack = (id: string, memberId: string, over: Partial<ClassPack> = {}): ClassPack => ({
  id,
  studioId: "s1",
  memberId,
  creditsTotal: 5,
  creditsRemaining: 5,
  priceCents: 5000,
  status: "active",
  purchasedAt: ISO,
  createdAt: ISO,
  ...over,
});

describe("packages service", () => {
  let repos: Repositories;

  beforeEach(async () => {
    repos = createInMemoryRepositories(baseSeed());
  });

  describe("createPackage", () => {
    it("creates a 5-credit pack with correct pricing", async () => {
      await repos.members.insert(member("m1"));
      const result = await createPackage(repos, "s1", { memberId: "m1", credits: 5 });
      expect(result).toMatchObject({
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 5,
        priceCents: 5000,
        status: "active",
      });
      expect(result.id).toBeDefined();
      expect(result.purchasedAt).toBeDefined();
    });

    it("creates a 10-credit pack with correct pricing", async () => {
      await repos.members.insert(member("m1"));
      const result = await createPackage(repos, "s1", { memberId: "m1", credits: 10 });
      expect(result).toMatchObject({
        creditsTotal: 10,
        creditsRemaining: 10,
        priceCents: 10000,
        status: "active",
      });
    });

    it("404s for unknown member", async () => {
      await expect(
        createPackage(repos, "s1", { memberId: "nope", credits: 5 }),
      ).rejects.toMatchObject({ status: 404, code: "not_found" });
    });

    it("403s when member belongs to different studio", async () => {
      await repos.members.insert(member("m1", { studioId: "s2" }));
      await expect(
        createPackage(repos, "s1", { memberId: "m1", credits: 5 }),
      ).rejects.toMatchObject({ status: 403, code: "forbidden" });
    });
  });

  describe("listPackages", () => {
    it("returns empty list when member has no packs", async () => {
      await repos.members.insert(member("m1"));
      const result = await listPackages(repos, "s1", "m1");
      expect(result).toEqual([]);
    });

    it("returns packs newest-first", async () => {
      await repos.members.insert(member("m1"));
      const oldPack = pack("p1", "m1", { purchasedAt: "2026-07-25T00:00:00Z" });
      const newPack = pack("p2", "m1", { purchasedAt: "2026-07-26T00:00:00Z" });
      await repos.classPacks.insert(oldPack);
      await repos.classPacks.insert(newPack);

      const result = await listPackages(repos, "s1", "m1");
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("p2");
      expect(result[1].id).toBe("p1");
    });

    it("returns correct DTO shape without studio fields", async () => {
      await repos.members.insert(member("m1"));
      await repos.classPacks.insert(pack("p1", "m1"));
      const [result] = await listPackages(repos, "s1", "m1");
      expect(Object.keys(result).sort()).toEqual([
        "creditsRemaining",
        "creditsTotal",
        "id",
        "memberId",
        "priceCents",
        "purchasedAt",
        "status",
      ]);
    });
  });

  describe("refundPackage", () => {
    it("sets creditsRemaining to 0 and status to refunded", async () => {
      await repos.classPacks.insert(pack("p1", "m1", { creditsRemaining: 3 }));
      const result = await refundPackage(repos, "s1", "p1");
      expect(result).toMatchObject({
        creditsRemaining: 0,
        status: "refunded",
      });
    });

    it("404s for unknown pack", async () => {
      await expect(refundPackage(repos, "s1", "nope")).rejects.toMatchObject({
        status: 404,
        code: "not_found",
      });
    });
  });

  describe("bookings with packs", () => {
    beforeEach(async () => {
      await repos.members.insert(member("m1"));
      await repos.classTypes.insert(classType("ct1"));
      await repos.classSessions.insert(session("cs1"));
    });

    it("member with no pack books as before", async () => {
      const result = await createBooking(repos, createFakeProvider(), {
        memberId: "m1",
        sessionId: "cs1",
      });
      expect(result.bookingId).toBeDefined();
      expect(result.status).toBe("booked");
    });

    it("member with active pack books and spends one credit", async () => {
      await repos.classPacks.insert(pack("p1", "m1", { creditsRemaining: 3 }));
      const result = await createBooking(repos, createFakeProvider(), {
        memberId: "m1",
        sessionId: "cs1",
      });
      expect(result.bookingId).toBeDefined();

      const updated = await repos.classPacks.getById("p1");
      expect(updated?.creditsRemaining).toBe(2);
      expect(updated?.status).toBe("active");
    });

    it("spends from oldest pack first", async () => {
      const oldPack = pack("p1", "m1", {
        creditsRemaining: 2,
        purchasedAt: "2026-07-25T00:00:00Z",
      });
      const newPack = pack("p2", "m1", {
        creditsRemaining: 5,
        purchasedAt: "2026-07-26T00:00:00Z",
      });
      await repos.classPacks.insert(oldPack);
      await repos.classPacks.insert(newPack);

      await createBooking(repos, createFakeProvider(), {
        memberId: "m1",
        sessionId: "cs1",
      });

      const old = await repos.classPacks.getById("p1");
      const new_ = await repos.classPacks.getById("p2");
      expect(old?.creditsRemaining).toBe(1);
      expect(new_?.creditsRemaining).toBe(5);
    });

    it("flips status to exhausted when last credit is spent", async () => {
      await repos.classPacks.insert(pack("p1", "m1", { creditsRemaining: 1 }));
      await createBooking(repos, createFakeProvider(), {
        memberId: "m1",
        sessionId: "cs1",
      });

      const updated = await repos.classPacks.getById("p1");
      expect(updated?.creditsRemaining).toBe(0);
      expect(updated?.status).toBe("exhausted");
    });

    it("402 pack_exhausted when all packs are empty", async () => {
      await repos.classPacks.insert(pack("p1", "m1", { creditsRemaining: 0, status: "exhausted" }));
      await expect(
        createBooking(repos, createFakeProvider(), {
          memberId: "m1",
          sessionId: "cs1",
        }),
      ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    });

    it("skips refunded packs", async () => {
      await repos.classPacks.insert(pack("p1", "m1", { status: "refunded", creditsRemaining: 5 }));
      await repos.classPacks.insert(pack("p2", "m1", { creditsRemaining: 3 }));

      await createBooking(repos, createFakeProvider(), {
        memberId: "m1",
        sessionId: "cs1",
      });

      const refunded = await repos.classPacks.getById("p1");
      const active = await repos.classPacks.getById("p2");
      expect(refunded?.creditsRemaining).toBe(5);
      expect(active?.creditsRemaining).toBe(2);
    });

    it("duplicate booking still 409s and spends no credit", async () => {
      await repos.classPacks.insert(pack("p1", "m1", { creditsRemaining: 3 }));
      await createBooking(repos, createFakeProvider(), {
        memberId: "m1",
        sessionId: "cs1",
      });

      await expect(
        createBooking(repos, createFakeProvider(), {
          memberId: "m1",
          sessionId: "cs1",
        }),
      ).rejects.toMatchObject({ status: 409, code: "booking_already_booked" });

      const unchanged = await repos.classPacks.getById("p1");
      expect(unchanged?.creditsRemaining).toBe(2);
    });

    it("refunded pack after creation prevents future bookings", async () => {
      const p = await repos.classPacks.insert(pack("p1", "m1", { creditsRemaining: 5 }));
      await createBooking(repos, createFakeProvider(), {
        memberId: "m1",
        sessionId: "cs1",
      });

      await refundPackage(repos, "s1", p.id);

      await repos.classSessions.insert(session("cs2"));
      await expect(
        createBooking(repos, createFakeProvider(), {
          memberId: "m1",
          sessionId: "cs2",
        }),
      ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    });
  });

  describe("drawCreditForBooking direct", () => {
    it("no-ops when member has no packs", async () => {
      await expect(drawCreditForBooking(repos, "m1")).resolves.toBeUndefined();
    });

    it("402 when member has packs but all empty", async () => {
      await repos.classPacks.insert(pack("p1", "m1", { creditsRemaining: 0, status: "exhausted" }));
      await expect(drawCreditForBooking(repos, "m1")).rejects.toMatchObject({
        status: 402,
        code: "pack_exhausted",
      });
    });

    it("decrements from oldest drawable pack", async () => {
      const p1 = pack("p1", "m1", {
        creditsRemaining: 2,
        purchasedAt: "2026-07-25T00:00:00Z",
      });
      const p2 = pack("p2", "m1", { creditsRemaining: 5, purchasedAt: "2026-07-26T00:00:00Z" });
      await repos.classPacks.insert(p1);
      await repos.classPacks.insert(p2);

      await drawCreditForBooking(repos, "m1");

      const old = await repos.classPacks.getById("p1");
      const new_ = await repos.classPacks.getById("p2");
      expect(old?.creditsRemaining).toBe(1);
      expect(new_?.creditsRemaining).toBe(5);
    });
  });
});
