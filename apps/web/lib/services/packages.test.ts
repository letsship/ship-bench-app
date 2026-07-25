import { describe, it, expect, beforeEach } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createBooking } from "./bookings";
import { createPackage, listPackages, refundPackage, drawCreditForMember } from "./packages";

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
    packages: [],
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
  ...over,
});

describe("packages service", () => {
  let repos: Repositories;
  let studioId: string;
  let memberId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
      }),
    );
    studioId = (await repos.studios.getFirst())?.id ?? "";
    memberId = (await repos.members.listByStudio(studioId))[0].id;
  });

  describe("createPackage", () => {
    it("creates a 5-credit pack with priceCents = 5000", async () => {
      const result = await createPackage(repos, studioId, { memberId, credits: 5 });
      expect(result.creditsTotal).toBe(5);
      expect(result.creditsRemaining).toBe(5);
      expect(result.priceCents).toBe(5000);
      expect(result.status).toBe("active");
    });

    it("creates a 10-credit pack with priceCents = 10000", async () => {
      const result = await createPackage(repos, studioId, { memberId, credits: 10 });
      expect(result.creditsTotal).toBe(10);
      expect(result.creditsRemaining).toBe(10);
      expect(result.priceCents).toBe(10000);
      expect(result.status).toBe("active");
    });

    it("rejects an unknown member with 400", async () => {
      await expect(
        createPackage(repos, studioId, { memberId: "nope", credits: 5 }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("rejects a member from a different studio with 400", async () => {
      const otherMember = member("m2", { studioId: "s2" });
      await repos.members.insert(otherMember);
      await expect(
        createPackage(repos, studioId, { memberId: "m2", credits: 5 }),
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe("listPackages", () => {
    it("lists packs for a member, newest first", async () => {
      const p1 = await repos.classPacks.insert(
        pack("p1", memberId, { purchasedAt: "2026-01-01T00:00:00Z" }),
      );
      const p2 = await repos.classPacks.insert(
        pack("p2", memberId, { purchasedAt: "2026-01-05T00:00:00Z" }),
      );
      const p3 = await repos.classPacks.insert(
        pack("p3", memberId, { purchasedAt: "2026-01-03T00:00:00Z" }),
      );

      const result = await listPackages(repos, memberId);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(p2.id);
      expect(result[1].id).toBe(p3.id);
      expect(result[2].id).toBe(p1.id);
    });

    it("returns empty list if member has no packs", async () => {
      const result = await listPackages(repos, memberId);
      expect(result).toEqual([]);
    });
  });

  describe("refundPackage", () => {
    it("sets creditsRemaining to 0 and status to refunded", async () => {
      await repos.classPacks.insert(pack("p1", memberId));
      const result = await refundPackage(repos, "p1");
      expect(result.creditsRemaining).toBe(0);
      expect(result.status).toBe("refunded");
    });

    it("404s for an unknown pack", async () => {
      await expect(refundPackage(repos, "nope")).rejects.toMatchObject({ status: 404 });
    });

    it("is idempotent (calling on already-refunded pack)", async () => {
      await repos.classPacks.insert(pack("p1", memberId));
      await refundPackage(repos, "p1");
      const result = await refundPackage(repos, "p1");
      expect(result.creditsRemaining).toBe(0);
      expect(result.status).toBe("refunded");
    });
  });

  describe("drawCreditForMember", () => {
    it("does nothing if member has no packs", async () => {
      await expect(drawCreditForMember(repos, memberId)).resolves.toBeUndefined();
    });

    it("decrements creditsRemaining on the oldest active pack", async () => {
      const p1 = await repos.classPacks.insert(
        pack("p1", memberId, { purchasedAt: "2026-01-01T00:00:00Z" }),
      );
      const p2 = await repos.classPacks.insert(
        pack("p2", memberId, { purchasedAt: "2026-01-05T00:00:00Z" }),
      );

      await drawCreditForMember(repos, memberId);

      const updated = await repos.classPacks.getById(p1.id);
      expect(updated?.creditsRemaining).toBe(4);
      const unchanged = await repos.classPacks.getById(p2.id);
      expect(unchanged?.creditsRemaining).toBe(5);
    });

    it("throws 402 pack_exhausted when all packs are out of credits", async () => {
      await repos.classPacks.insert(
        pack("p1", memberId, { creditsRemaining: 0, status: "active" }),
      );
      await expect(drawCreditForMember(repos, memberId)).rejects.toMatchObject({
        status: 402,
        code: "pack_exhausted",
      });
    });

    it("throws 402 pack_exhausted when all packs are refunded", async () => {
      await repos.classPacks.insert(pack("p1", memberId, { status: "refunded" }));
      await expect(drawCreditForMember(repos, memberId)).rejects.toMatchObject({
        status: 402,
        code: "pack_exhausted",
      });
    });

    it("skips refunded packs and uses the active one", async () => {
      const p1 = await repos.classPacks.insert(pack("p1", memberId, { status: "refunded" }));
      const p2 = await repos.classPacks.insert(
        pack("p2", memberId, { purchasedAt: "2026-01-05T00:00:00Z" }),
      );

      await drawCreditForMember(repos, memberId);

      const unchanged = await repos.classPacks.getById(p1.id);
      expect(unchanged?.creditsRemaining).toBe(5);
      const updated = await repos.classPacks.getById(p2.id);
      expect(updated?.creditsRemaining).toBe(4);
    });
  });

  describe("booking integration", () => {
    beforeEach(async () => {
      repos = createInMemoryRepositories(
        baseSeed({
          members: [member("m1"), member("m2")],
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
        }),
      );
      studioId = (await repos.studios.getFirst())?.id ?? "";
      memberId = (await repos.members.listByStudio(studioId))[0].id;
    });

    it("a member with an active pack books normally and spends a credit", async () => {
      await repos.classPacks.insert(pack("p1", memberId, { creditsRemaining: 5 }));

      const result = await createBooking(repos, createFakeProvider(), {
        sessionId: "cs1",
        memberId,
      });

      expect(result.status).toBe("booked");
      const updated = await repos.classPacks.getById("p1");
      expect(updated?.creditsRemaining).toBe(4);
    });

    it("a member with no pack books unchanged", async () => {
      const result = await createBooking(repos, createFakeProvider(), {
        sessionId: "cs1",
        memberId,
      });

      expect(result.status).toBe("booked");
      const packs = await listPackages(repos, memberId);
      expect(packs).toHaveLength(0);
    });

    it("a member with exhausted pack cannot book, gets 402 pack_exhausted", async () => {
      await repos.classPacks.insert(pack("p1", memberId, { creditsRemaining: 0 }));

      await expect(
        createBooking(repos, createFakeProvider(), {
          sessionId: "cs1",
          memberId,
        }),
      ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    });

    it("double-booking still returns 409 before spending a credit", async () => {
      await repos.classPacks.insert(pack("p1", memberId, { creditsRemaining: 5 }));
      await createBooking(repos, createFakeProvider(), {
        sessionId: "cs1",
        memberId,
      });

      await expect(
        createBooking(repos, createFakeProvider(), {
          sessionId: "cs1",
          memberId,
        }),
      ).rejects.toMatchObject({ status: 409, code: "booking_already_booked" });

      const pack1 = await repos.classPacks.getById("p1");
      expect(pack1?.creditsRemaining).toBe(4);
    });
  });
});
