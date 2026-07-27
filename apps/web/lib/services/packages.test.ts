import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, ClassType, Member } from "@/lib/db/types";
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

describe("packages service", () => {
  let repos: Repositories;
  let studioId: string;
  let memberId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1"), session("cs2"), session("cs3"), session("cs4"), session("cs5")],
        members: [member("m1"), member("m2")],
      }),
    );
    studioId = (await repos.studios.getFirst())?.id ?? "";
    memberId = (await repos.members.listByStudio(studioId))[0].id;
  });

  describe("createPackage", () => {
    it("creates a 5-credit pack with correct pricing", async () => {
      const pkg = await createPackage(repos, studioId, { memberId, credits: 5 });
      expect(pkg.memberId).toBe(memberId);
      expect(pkg.creditsTotal).toBe(5);
      expect(pkg.creditsRemaining).toBe(5);
      expect(pkg.priceCents).toBe(5000);
      expect(pkg.status).toBe("active");
    });

    it("creates a 10-credit pack with correct pricing", async () => {
      const pkg = await createPackage(repos, studioId, { memberId, credits: 10 });
      expect(pkg.memberId).toBe(memberId);
      expect(pkg.creditsTotal).toBe(10);
      expect(pkg.creditsRemaining).toBe(10);
      expect(pkg.priceCents).toBe(10000);
      expect(pkg.status).toBe("active");
    });

    it("rejects an unknown member", async () => {
      await expect(
        createPackage(repos, studioId, { memberId: "unknown", credits: 5 }),
      ).rejects.toMatchObject({ status: 400, code: "bad_request" });
    });

    it("rejects a member from a different studio", async () => {
      const otherMember = member("m3", { studioId: "s2" });
      await repos.members.insert(otherMember);
      await expect(
        createPackage(repos, studioId, { memberId: otherMember.id, credits: 5 }),
      ).rejects.toMatchObject({ status: 400, code: "bad_request" });
    });
  });

  describe("listPackages", () => {
    it("returns packages newest-first", async () => {
      const pkg1 = await createPackage(repos, studioId, { memberId, credits: 5 });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const pkg2 = await createPackage(repos, studioId, { memberId, credits: 10 });

      const list = await listPackages(repos, memberId);
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(pkg2.id);
      expect(list[1].id).toBe(pkg1.id);
    });

    it("returns empty for a member with no packages", async () => {
      const list = await listPackages(repos, memberId);
      expect(list).toHaveLength(0);
    });
  });

  describe("bookings draw from packs", () => {
    it("draws one credit from the oldest active pack on booking", async () => {
      const pkg = await createPackage(repos, studioId, { memberId, credits: 5 });
      expect(pkg.creditsRemaining).toBe(5);

      const provider = createFakeProvider();
      await createBooking(repos, provider, { sessionId: "cs1", memberId });

      const updated = await repos.packages.getById(pkg.id);
      expect(updated?.creditsRemaining).toBe(4);
    });

    it("draws from the oldest pack when multiple exist", async () => {
      const pkg1 = await createPackage(repos, studioId, { memberId, credits: 5 });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const pkg2 = await createPackage(repos, studioId, { memberId, credits: 10 });

      const provider = createFakeProvider();
      await createBooking(repos, provider, { sessionId: "cs1", memberId });

      const pkg1After = await repos.packages.getById(pkg1.id);
      const pkg2After = await repos.packages.getById(pkg2.id);
      expect(pkg1After?.creditsRemaining).toBe(4);
      expect(pkg2After?.creditsRemaining).toBe(10);
    });

    it("rejects with 402 pack_exhausted when all packs are depleted", async () => {
      await createPackage(repos, studioId, { memberId, credits: 1 });

      const provider = createFakeProvider();
      await createBooking(repos, provider, { sessionId: "cs1", memberId });

      await expect(
        createBooking(repos, provider, { sessionId: "cs2", memberId }),
      ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    });

    it("does not affect members with no packs", async () => {
      const provider = createFakeProvider();
      const result = await createBooking(repos, provider, {
        sessionId: "cs1",
        memberId,
      });
      expect(result.status).toBe("booked");
    });

    it("preserves the 409 double-booking error and spends no credit", async () => {
      await createPackage(repos, studioId, { memberId, credits: 5 });

      const provider = createFakeProvider();
      await createBooking(repos, provider, { sessionId: "cs1", memberId });

      const pkg = await listPackages(repos, memberId);
      const creditsAfterFirstBooking = pkg[0].creditsRemaining;

      await expect(
        createBooking(repos, provider, { sessionId: "cs1", memberId }),
      ).rejects.toMatchObject({ status: 409, code: "booking_already_booked" });

      const pkgAfter = await listPackages(repos, memberId);
      expect(pkgAfter[0].creditsRemaining).toBe(creditsAfterFirstBooking);
    });
  });

  describe("refundPackage", () => {
    it("sets creditsRemaining to 0 and status to refunded", async () => {
      const pkg = await createPackage(repos, studioId, { memberId, credits: 10 });
      expect(pkg.creditsRemaining).toBe(10);

      const refunded = await refundPackage(repos, pkg.id);
      expect(refunded.creditsRemaining).toBe(0);
      expect(refunded.status).toBe("refunded");
    });

    it("prevents drawing from a refunded pack", async () => {
      const pkg = await createPackage(repos, studioId, { memberId, credits: 10 });
      await refundPackage(repos, pkg.id);

      const provider = createFakeProvider();
      await expect(
        createBooking(repos, provider, { sessionId: "cs1", memberId }),
      ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    });

    it("404s for an unknown package", async () => {
      await expect(refundPackage(repos, "unknown")).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("drawCreditForBooking", () => {
    it("does not throw when member has no packs", async () => {
      await expect(drawCreditForBooking(repos, memberId)).resolves.not.toThrow();
    });

    it("throws 402 pack_exhausted when all packs are depleted", async () => {
      await createPackage(repos, studioId, { memberId, credits: 1 });

      await expect(drawCreditForBooking(repos, memberId)).resolves.not.toThrow();

      await expect(drawCreditForBooking(repos, memberId)).rejects.toMatchObject({
        status: 402,
        code: "pack_exhausted",
      });
    });
  });
});
