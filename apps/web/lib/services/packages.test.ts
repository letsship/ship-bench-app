import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { SeedData } from "@/lib/db/repos/fakes";
import { createPackage, listPackages, refundPackage } from "./packages";

describe("packages service", () => {
  let repos: Repositories;
  const studioId = "studio-1";
  const memberId = "member-1";

  beforeEach(() => {
    const seed: SeedData = {
      studio: { id: studioId, name: "Test Studio", slug: "test", timezone: "UTC", createdAt: "" },
      settings: {
        studioId,
        currency: "EUR",
        taxRateBps: 0,
        cancellationWindowHours: 12,
        waitlistEnabled: true,
        notifyBookingConfirmations: true,
        notifyCancellations: true,
        notifyWaitlistPromotions: true,
        notifyInvoices: true,
      },
      members: [
        {
          id: memberId,
          studioId,
          name: "Test Member",
          email: "test@example.com",
          phone: null,
          status: "active",
          notificationsOptedOut: false,
          createdAt: "",
        },
      ],
      classTypes: [],
      sessions: [],
      bookings: [],
      invoices: [],
      lineItems: [],
      outbox: [],
    };
    repos = createInMemoryRepositories(seed);
  });

  describe("createPackage", () => {
    it("creates a 5-credit pack with correct price", async () => {
      const pkg = await createPackage(repos, studioId, { memberId, credits: 5 });

      expect(pkg.creditsTotal).toBe(5);
      expect(pkg.creditsRemaining).toBe(5);
      expect(pkg.priceCents).toBe(5000);
      expect(pkg.status).toBe("active");
      expect(pkg.purchasedAt).toBeDefined();
    });

    it("creates a 10-credit pack with correct price", async () => {
      const pkg = await createPackage(repos, studioId, { memberId, credits: 10 });

      expect(pkg.creditsTotal).toBe(10);
      expect(pkg.creditsRemaining).toBe(10);
      expect(pkg.priceCents).toBe(10000);
      expect(pkg.status).toBe("active");
    });

    it("throws on unknown member", async () => {
      await expect(
        createPackage(repos, studioId, { memberId: "unknown", credits: 5 }),
      ).rejects.toThrow("Unknown member");
    });
  });

  describe("listPackages", () => {
    it("lists member's packs newest first", async () => {
      const pkg1 = await createPackage(repos, studioId, { memberId, credits: 5 });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const pkg2 = await createPackage(repos, studioId, { memberId, credits: 10 });

      const list = await listPackages(repos, memberId);

      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(pkg2.id);
      expect(list[1].id).toBe(pkg1.id);
    });

    it("returns empty array for member with no packs", async () => {
      const list = await listPackages(repos, "unknown-member");
      expect(list).toHaveLength(0);
    });
  });

  describe("refundPackage", () => {
    it("voids remaining credits and sets status to refunded", async () => {
      const pkg = await createPackage(repos, studioId, { memberId, credits: 10 });

      const refunded = await refundPackage(repos, pkg.id);

      expect(refunded.creditsRemaining).toBe(0);
      expect(refunded.status).toBe("refunded");
      expect(refunded.creditsTotal).toBe(10);
    });

    it("throws on unknown package id", async () => {
      await expect(refundPackage(repos, "unknown")).rejects.toThrow("Package not found");
    });
  });
});
