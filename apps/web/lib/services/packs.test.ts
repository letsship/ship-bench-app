import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createBooking } from "./bookings";
import { createPack, listPacks, refundPack } from "./packs";

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

const pack = (id: string, over: Partial<ClassPack> = {}): ClassPack => ({
  id,
  studioId: "s1",
  memberId: "m1",
  creditsTotal: 5,
  creditsRemaining: 5,
  priceCents: 5000,
  status: "active",
  purchasedAt: ISO,
  createdAt: ISO,
  ...over,
});

describe("packs service", () => {
  let repos: Repositories;
  let studioId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
    studioId = (await repos.studios.getFirst())?.id ?? "";
  });

  describe("createPack", () => {
    it("creates a 5-credit pack with correct price", async () => {
      const result = await createPack(repos, studioId, { memberId: "m1", credits: 5 });
      expect(result.creditsTotal).toBe(5);
      expect(result.creditsRemaining).toBe(5);
      expect(result.priceCents).toBe(5000);
      expect(result.status).toBe("active");
    });

    it("creates a 10-credit pack with correct price", async () => {
      const result = await createPack(repos, studioId, { memberId: "m1", credits: 10 });
      expect(result.creditsTotal).toBe(10);
      expect(result.creditsRemaining).toBe(10);
      expect(result.priceCents).toBe(10000);
      expect(result.status).toBe("active");
    });

    it("rejects for an unknown member", async () => {
      await expect(
        createPack(repos, studioId, { memberId: "unknown", credits: 5 }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("rejects if member belongs to different studio", async () => {
      const otherStudio = await repos.studios.getFirst();
      if (otherStudio) {
        await expect(
          createPack(repos, "other-studio-id", { memberId: "m1", credits: 5 }),
        ).rejects.toMatchObject({ status: 403 });
      }
    });
  });

  describe("listPacks", () => {
    it("returns packs newest first", async () => {
      const older = pack("p1", { purchasedAt: "2026-01-01T00:00:00Z" });
      const newer = pack("p2", { purchasedAt: "2026-01-02T00:00:00Z" });
      await repos.classPacks.insert(newer);
      await repos.classPacks.insert(older);

      const result = await listPacks(repos, "m1");
      expect(result[0].id).toBe("p2");
      expect(result[1].id).toBe("p1");
    });

    it("returns empty list if member has no packs", async () => {
      const result = await listPacks(repos, "m1");
      expect(result).toEqual([]);
    });
  });

  describe("refundPack", () => {
    it("sets pack to refunded with 0 credits", async () => {
      const p = pack("p1", { creditsRemaining: 3 });
      await repos.classPacks.insert(p);

      const result = await refundPack(repos, "p1");
      expect(result.status).toBe("refunded");
      expect(result.creditsRemaining).toBe(0);
    });

    it("404s for unknown pack", async () => {
      await expect(refundPack(repos, "unknown")).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("packs and bookings integration", () => {
    beforeEach(async () => {
      repos = createInMemoryRepositories(
        baseSeed({
          members: [member("m1")],
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
        }),
      );
      studioId = (await repos.studios.getFirst())?.id ?? "";
    });

    it("booking draws from pack and decrements oldest first", async () => {
      const p1 = pack("p1", { purchasedAt: "2026-01-01T00:00:00Z", creditsRemaining: 2 });
      const p2 = pack("p2", { purchasedAt: "2026-01-02T00:00:00Z", creditsRemaining: 3 });
      await repos.classPacks.insert(p1);
      await repos.classPacks.insert(p2);

      await createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" });

      const updated = await repos.classPacks.getById("p1");
      expect(updated?.creditsRemaining).toBe(1);
    });

    it("member without pack books unchanged", async () => {
      const result = await createBooking(repos, createFakeProvider(), {
        sessionId: "cs1",
        memberId: "m1",
      });
      expect(result.status).toBe("booked");

      const packs = await repos.classPacks.listByMember("m1");
      expect(packs).toHaveLength(0);
    });

    it("booking rejected if all packs exhausted", async () => {
      const p = pack("p1", { creditsRemaining: 0 });
      await repos.classPacks.insert(p);

      await expect(
        createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
      ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    });

    it("booking rejected if all packs refunded", async () => {
      const p = pack("p1", { status: "refunded", creditsRemaining: 5 });
      await repos.classPacks.insert(p);

      await expect(
        createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
      ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    });

    it("double booking still fails 409 and spends no credit", async () => {
      const p = pack("p1", { creditsRemaining: 5 });
      await repos.classPacks.insert(p);
      await createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" });

      await expect(
        createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
      ).rejects.toMatchObject({ status: 409, code: "booking_already_booked" });

      const updated = await repos.classPacks.getById("p1");
      expect(updated?.creditsRemaining).toBe(4);
    });
  });
});
