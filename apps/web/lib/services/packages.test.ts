import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as packagesGet } from "@/app/api/packages/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Booking, ClassPack, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createBooking } from "./bookings";

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

const booking = (id: string, memberId: string, over: Partial<Booking> = {}): Booking => ({
  id,
  sessionId: "cs1",
  memberId,
  status: "booked",
  bookedAt: ISO,
  cancelledAt: null,
  ...over,
});

const pack = (id: string, memberId: string, over: Partial<ClassPack> = {}): ClassPack => ({
  id,
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

  describe("buyPackage", () => {
    it("creates a 5-credit active pack with correct price and credits", async () => {
      repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
      const { buyPackage } = await import("./packages");
      const result = await buyPackage(repos, { memberId: "m1", credits: 5 });
      expect(result.creditsTotal).toBe(5);
      expect(result.creditsRemaining).toBe(5);
      expect(result.priceCents).toBe(5000);
      expect(result.status).toBe("active");
      expect(result.memberId).toBe("m1");
    });

    it("creates a 10-credit active pack with 10000 priceCents", async () => {
      repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
      const { buyPackage } = await import("./packages");
      const result = await buyPackage(repos, { memberId: "m1", credits: 10 });
      expect(result.creditsTotal).toBe(10);
      expect(result.priceCents).toBe(10000);
      expect(result.creditsRemaining).toBe(10);
    });

    it("throws 404 for unknown member", async () => {
      repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
      const { buyPackage } = await import("./packages");
      await expect(
        buyPackage(repos, { memberId: "nobody", credits: 5 }),
      ).rejects.toMatchObject({ status: 404, code: "not_found" });
    });
  });

  describe("listPackages", () => {
    it("returns member packs newest first", async () => {
      repos = createInMemoryRepositories(
        baseSeed({
          members: [member("m1")],
          packages: [
            pack("p1", "m1", { purchasedAt: "2026-06-01T10:00:00.000Z" }),
            pack("p2", "m1", { purchasedAt: "2026-07-01T10:00:00.000Z" }),
          ],
        }),
      );
      const { listPackages } = await import("./packages");
      const result = await listPackages(repos, "m1");
      expect(result.map((p) => p.id)).toEqual(["p2", "p1"]);
    });

    it("returns empty array for a member with no packs", async () => {
      repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
      const { listPackages } = await import("./packages");
      const result = await listPackages(repos, "m1");
      expect(result).toEqual([]);
    });
  });

  describe("refundPackage", () => {
    it("zeroes credits and sets status to refunded", async () => {
      repos = createInMemoryRepositories(
        baseSeed({ members: [member("m1")], packages: [pack("p1", "m1")] }),
      );
      const { refundPackage } = await import("./packages");
      const result = await refundPackage(repos, "p1");
      expect(result.creditsRemaining).toBe(0);
      expect(result.status).toBe("refunded");
    });

    it("throws 404 for unknown pack", async () => {
      repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
      const { refundPackage } = await import("./packages");
      await expect(refundPackage(repos, "nope")).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("booking draws from pack", () => {
    it("decrements creditsRemaining by one when member has an active pack (oldest first)", async () => {
      repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [member("m1")],
          packages: [
            pack("p1", "m1", { creditsRemaining: 2, purchasedAt: "2026-06-01T10:00:00.000Z" }),
            pack("p2", "m1", { creditsRemaining: 5, purchasedAt: "2026-07-01T10:00:00.000Z" }),
          ],
        }),
      );
      const provider = createFakeProvider();
      const result = await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });
      expect(result.status).toBe("booked");
      const p1 = await repos.classPacks.getById("p1");
      expect(p1?.creditsRemaining).toBe(1);
      const p2 = await repos.classPacks.getById("p2");
      expect(p2?.creditsRemaining).toBe(5);
    });

    it("rejects with 402 pack_exhausted when all packs are empty", async () => {
      repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [member("m1")],
          packages: [
            pack("p1", "m1", { creditsRemaining: 0 }),
          ],
        }),
      );
      await expect(
        createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
      ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    });

    it("rejects with 402 pack_exhausted when the only pack is refunded", async () => {
      repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [member("m1")],
          packages: [
            pack("p1", "m1", { creditsRemaining: 3, status: "refunded" }),
          ],
        }),
      );
      await expect(
        createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
      ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    });

    it("does not insert a booking when pack_exhausted", async () => {
      repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [member("m1")],
          packages: [pack("p1", "m1", { creditsRemaining: 0 })],
        }),
      );
      await expect(
        createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
      ).rejects.toThrow();
      const bookings = await repos.bookings.listBySession("cs1");
      expect(bookings).toHaveLength(0);
    });

    it("still throws 409 for a duplicate booking and spends no credit", async () => {
      repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [member("m1")],
          bookings: [booking("b1", "m1")],
          packages: [pack("p1", "m1", { creditsRemaining: 5 })],
        }),
      );
      await expect(
        createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
      ).rejects.toMatchObject({ status: 409, code: "booking_already_booked" });
      const p1 = await repos.classPacks.getById("p1");
      expect(p1?.creditsRemaining).toBe(5);
    });

    it("leaves a member with no pack completely unchanged", async () => {
      repos = createInMemoryRepositories(
        baseSeed({
          classTypes: [classType("ct1")],
          sessions: [session("cs1")],
          members: [member("m1")],
        }),
      );
      const provider = createFakeProvider();
      const result = await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });
      expect(result.status).toBe("booked");
    });
  });

  describe("route handlers (against injected fake repos)", () => {
    beforeEach(() => {
      repos = createInMemoryRepositories(
        baseSeed({ members: [member("m1")], packages: [pack("p1", "m1")] }),
      );
      __setTestRepositories(repos);
    });
    afterEach(() => {
      __setTestRepositories(null);
    });

    it("GET /api/packages?memberId=m1 returns packs", async () => {
      const res = await packagesGet(new NextRequest("http://localhost/api/packages?memberId=m1"));
      expect(res.status).toBe(200);
      const body = (await res.json()) as ClassPack[];
      expect(body).toHaveLength(1);
      expect(body[0].creditsTotal).toBe(5);
    });

    it("GET /api/packages 400s without memberId", async () => {
      const res = await packagesGet(new NextRequest("http://localhost/api/packages"));
      expect(res.status).toBe(400);
    });
  });
});