import { describe, expect, it } from "vitest";
import type { ClassPack } from "@/lib/db/types";
import { hasEverPurchased, packPriceCents, selectDrawablePack } from "./packs";

describe("packs", () => {
  describe("packPriceCents", () => {
    it("returns 5000 for 5 credits", () => {
      expect(packPriceCents(5)).toBe(5000);
    });

    it("returns 10000 for 10 credits", () => {
      expect(packPriceCents(10)).toBe(10000);
    });
  });

  describe("selectDrawablePack", () => {
    it("returns the oldest active pack with credits remaining", () => {
      const older: ClassPack = {
        id: "pack1",
        studioId: "studio1",
        memberId: "member1",
        creditsTotal: 5,
        creditsRemaining: 2,
        priceCents: 5000,
        status: "active",
        purchasedAt: "2024-01-01T10:00:00Z",
      };

      const newer: ClassPack = {
        id: "pack2",
        studioId: "studio1",
        memberId: "member1",
        creditsTotal: 10,
        creditsRemaining: 5,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2024-01-02T10:00:00Z",
      };

      expect(selectDrawablePack([newer, older])).toEqual(older);
    });

    it("skips refunded packs", () => {
      const refunded: ClassPack = {
        id: "pack1",
        studioId: "studio1",
        memberId: "member1",
        creditsTotal: 5,
        creditsRemaining: 0,
        priceCents: 5000,
        status: "refunded",
        purchasedAt: "2024-01-01T10:00:00Z",
      };

      const active: ClassPack = {
        id: "pack2",
        studioId: "studio1",
        memberId: "member1",
        creditsTotal: 10,
        creditsRemaining: 5,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2024-01-02T10:00:00Z",
      };

      expect(selectDrawablePack([refunded, active])).toEqual(active);
    });

    it("skips packs with zero credits remaining", () => {
      const exhausted: ClassPack = {
        id: "pack1",
        studioId: "studio1",
        memberId: "member1",
        creditsTotal: 5,
        creditsRemaining: 0,
        priceCents: 5000,
        status: "active",
        purchasedAt: "2024-01-01T10:00:00Z",
      };

      const active: ClassPack = {
        id: "pack2",
        studioId: "studio1",
        memberId: "member1",
        creditsTotal: 10,
        creditsRemaining: 5,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2024-01-02T10:00:00Z",
      };

      expect(selectDrawablePack([exhausted, active])).toEqual(active);
    });

    it("returns null when no drawable pack is found", () => {
      const exhausted: ClassPack = {
        id: "pack1",
        studioId: "studio1",
        memberId: "member1",
        creditsTotal: 5,
        creditsRemaining: 0,
        priceCents: 5000,
        status: "active",
        purchasedAt: "2024-01-01T10:00:00Z",
      };

      expect(selectDrawablePack([exhausted])).toBeNull();
    });
  });

  describe("hasEverPurchased", () => {
    it("returns true when packs list has items", () => {
      const pack: ClassPack = {
        id: "pack1",
        studioId: "studio1",
        memberId: "member1",
        creditsTotal: 5,
        creditsRemaining: 5,
        priceCents: 5000,
        status: "active",
        purchasedAt: "2024-01-01T10:00:00Z",
      };

      expect(hasEverPurchased([pack])).toBe(true);
    });

    it("returns false when packs list is empty", () => {
      expect(hasEverPurchased([])).toBe(false);
    });
  });
});
