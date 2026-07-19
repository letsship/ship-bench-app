import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Member, Package } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createBooking } from "./bookings";
import { createPackage, listPackages, refundPackage } from "./packages";

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
    packages: [],
    outbox: [],
    ...over,
  };
}

const member = (id: string, studioId = "s1"): Member => ({
  id,
  studioId,
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
});

describe("packages service", () => {
  let repos: Repositories;

  beforeEach(() => {
    const seed = baseSeed({
      members: [member("m1")],
      classTypes: [
        {
          id: "ct1",
          studioId: "s1",
          name: "Yoga",
          description: null,
          color: "#111",
          defaultCapacity: 10,
          defaultPriceCents: 1000,
          createdAt: ISO,
        },
      ],
      sessions: [
        {
          id: "cs1",
          studioId: "s1",
          classTypeId: "ct1",
          instructor: "I",
          startsAt: FUTURE,
          endsAt: FUTURE_END,
          capacity: 10,
          priceCents: 1000,
          status: "scheduled",
          createdAt: ISO,
        },
      ],
    });
    repos = createInMemoryRepositories(seed);
  });

  describe("createPackage", () => {
    it("creates a 5-credit pack with priceCents = 5000", async () => {
      const result = await createPackage(repos, "s1", { memberId: "m1", credits: 5 });
      expect(result).toMatchObject({
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 5,
        priceCents: 5000,
        status: "active",
      });
      expect(result.id).toBeTruthy();
      expect(result.purchasedAt).toBeTruthy();
    });

    it("creates a 10-credit pack with priceCents = 10000", async () => {
      const result = await createPackage(repos, "s1", { memberId: "m1", credits: 10 });
      expect(result).toMatchObject({
        creditsTotal: 10,
        creditsRemaining: 10,
        priceCents: 10000,
      });
    });

    it("throws 404 if member not found", async () => {
      await expect(
        createPackage(repos, "s1", { memberId: "unknown", credits: 5 }),
      ).rejects.toMatchObject({ code: "not_found", status: 404 });
    });

    it("throws 400 if member belongs to different studio", async () => {
      const seed = baseSeed({ members: [member("m1", "other-studio")] });
      repos = createInMemoryRepositories(seed);
      await expect(
        createPackage(repos, "s1", { memberId: "m1", credits: 5 }),
      ).rejects.toMatchObject({ code: "bad_request", status: 400 });
    });
  });

  describe("listPackages", () => {
    it("returns empty list when member has no packages", async () => {
      const result = await listPackages(repos, "m1");
      expect(result).toEqual([]);
    });

    it("returns packages newest-first (by purchasedAt desc)", async () => {
      const now = new Date().toISOString();
      const later = new Date(new Date().getTime() + 1000).toISOString();

      const pkg1: Package = {
        id: "p1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 5,
        priceCents: 5000,
        status: "active",
        purchasedAt: now,
        createdAt: now,
      };
      const pkg2: Package = {
        id: "p2",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 10,
        creditsRemaining: 10,
        priceCents: 10000,
        status: "active",
        purchasedAt: later,
        createdAt: later,
      };

      await repos.packages.insert(pkg1);
      await repos.packages.insert(pkg2);

      const result = await listPackages(repos, "m1");
      expect(result.length).toBe(2);
      expect(result[0].id).toBe("p2"); // newer first
      expect(result[1].id).toBe("p1");
    });

    it("excludes memberId from the list view", async () => {
      const pkg: Package = {
        id: "p1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 5,
        priceCents: 5000,
        status: "active",
        purchasedAt: ISO,
        createdAt: ISO,
      };
      await repos.packages.insert(pkg);

      const result = await listPackages(repos, "m1");
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("creditsTotal");
      expect(result[0]).not.toHaveProperty("memberId");
    });
  });

  describe("refundPackage", () => {
    it("sets creditsRemaining to 0 and status to refunded", async () => {
      const pkg: Package = {
        id: "p1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 5,
        priceCents: 5000,
        status: "active",
        purchasedAt: ISO,
        createdAt: ISO,
      };
      await repos.packages.insert(pkg);

      const result = await refundPackage(repos, "p1");
      expect(result).toMatchObject({
        creditsRemaining: 0,
        status: "refunded",
      });
    });

    it("throws 404 if package not found", async () => {
      await expect(refundPackage(repos, "unknown")).rejects.toMatchObject({
        code: "not_found",
        status: 404,
      });
    });
  });

  describe("booking integration", () => {
    it("draws a credit from the oldest active pack on confirmed booking", async () => {
      const older: Package = {
        id: "older",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 3,
        priceCents: 5000,
        status: "active",
        purchasedAt: new Date(NOW.getTime() - 1000).toISOString(),
        createdAt: ISO,
      };
      const newer: Package = {
        id: "newer",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 5,
        priceCents: 5000,
        status: "active",
        purchasedAt: ISO,
        createdAt: ISO,
      };
      await repos.packages.insert(older);
      await repos.packages.insert(newer);

      const provider = createFakeProvider();
      await createBooking(repos, provider, { memberId: "m1", sessionId: "cs1" });

      const updatedOlder = await repos.packages.getById("older");
      expect(updatedOlder?.creditsRemaining).toBe(2); // decremented from oldest
    });

    it("returns 402 pack_exhausted when all packs are exhausted or refunded", async () => {
      const pkg: Package = {
        id: "p1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 0,
        priceCents: 5000,
        status: "active",
        purchasedAt: ISO,
        createdAt: ISO,
      };
      await repos.packages.insert(pkg);

      const provider = createFakeProvider();
      await expect(
        createBooking(repos, provider, { memberId: "m1", sessionId: "cs1" }),
      ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    });

    it("returns 409 booking_already_booked for duplicate bookings (spends no credit)", async () => {
      const pkg: Package = {
        id: "p1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 5,
        priceCents: 5000,
        status: "active",
        purchasedAt: ISO,
        createdAt: ISO,
      };
      await repos.packages.insert(pkg);

      const provider = createFakeProvider();
      await createBooking(repos, provider, { memberId: "m1", sessionId: "cs1" });

      // Try to book again — should reject before spending a credit
      await expect(
        createBooking(repos, provider, { memberId: "m1", sessionId: "cs1" }),
      ).rejects.toMatchObject({ status: 409, code: "booking_already_booked" });

      const pkg_after = await repos.packages.getById("p1");
      expect(pkg_after?.creditsRemaining).toBe(4); // only 1 credit spent
    });

    it("leaves members without a pack unchanged", async () => {
      // Member with no pack books normally
      const provider = createFakeProvider();
      const result = await createBooking(repos, provider, { memberId: "m1", sessionId: "cs1" });

      expect(result.bookingId).toBeTruthy();
      expect(result.status).toBe("booked");

      // Verify no credit was touched (no packages repo calls)
      const packages = await listPackages(repos, "m1");
      expect(packages).toEqual([]);
    });

    it("leaves waitlisted bookings untouched", async () => {
      // Create a pack for the member
      const pkg: Package = {
        id: "p1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 5,
        priceCents: 5000,
        status: "active",
        purchasedAt: ISO,
        createdAt: ISO,
      };
      await repos.packages.insert(pkg);

      // Create a full session (no waitlist)
      const fullSession = {
        id: "cs-full",
        studioId: "s1",
        classTypeId: "ct1",
        instructor: "I",
        startsAt: FUTURE,
        endsAt: FUTURE_END,
        capacity: 1,
        priceCents: 1000,
        status: "scheduled",
        createdAt: ISO,
      };
      await repos.classSessions.insert(fullSession);

      // Book one member to fill it
      const m2: Member = member("m2");
      await repos.members.insert(m2);
      const provider = createFakeProvider();
      await createBooking(repos, provider, { memberId: "m2", sessionId: "cs-full" });

      // Now book m1 to the full session (will be waitlisted)
      const result = await createBooking(repos, provider, { memberId: "m1", sessionId: "cs-full" });
      expect(result.status).toBe("waitlisted");

      // Verify no credit was spent
      const pkg_after = await repos.packages.getById("p1");
      expect(pkg_after?.creditsRemaining).toBe(5);
    });
  });
});
