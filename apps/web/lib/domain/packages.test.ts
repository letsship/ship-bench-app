import { describe, it, expect } from "vitest";
import type { ClassPack } from "@/lib/db/types";
import { priceForCredits, pickPackToDraw, memberHasPack } from "./packages";

describe("packages domain", () => {
  describe("priceForCredits", () => {
    it("calculates price for 5 credits", () => {
      expect(priceForCredits(5)).toBe(5000);
    });

    it("calculates price for 10 credits", () => {
      expect(priceForCredits(10)).toBe(10000);
    });
  });

  describe("pickPackToDraw", () => {
    it("returns null when no active drawable packs exist", () => {
      const packs: ClassPack[] = [];
      expect(pickPackToDraw(packs)).toBeNull();
    });

    it("returns null when all packs are exhausted", () => {
      const packs: ClassPack[] = [
        {
          id: "pack1",
          studioId: "studio1",
          memberId: "member1",
          creditsTotal: 5,
          creditsRemaining: 0,
          priceCents: 5000,
          status: "active",
          purchasedAt: new Date(2026, 0, 1).toISOString(),
          createdAt: new Date(2026, 0, 1).toISOString(),
        },
      ];
      expect(pickPackToDraw(packs)).toBeNull();
    });

    it("returns null when all packs are refunded", () => {
      const packs: ClassPack[] = [
        {
          id: "pack1",
          studioId: "studio1",
          memberId: "member1",
          creditsTotal: 5,
          creditsRemaining: 5,
          priceCents: 5000,
          status: "refunded",
          purchasedAt: new Date(2026, 0, 1).toISOString(),
          createdAt: new Date(2026, 0, 1).toISOString(),
        },
      ];
      expect(pickPackToDraw(packs)).toBeNull();
    });

    it("returns the oldest active pack with drawable credits", () => {
      const pack1: ClassPack = {
        id: "pack1",
        studioId: "studio1",
        memberId: "member1",
        creditsTotal: 5,
        creditsRemaining: 3,
        priceCents: 5000,
        status: "active",
        purchasedAt: new Date(2026, 0, 1).toISOString(),
        createdAt: new Date(2026, 0, 1).toISOString(),
      };
      const pack2: ClassPack = {
        id: "pack2",
        studioId: "studio1",
        memberId: "member1",
        creditsTotal: 10,
        creditsRemaining: 8,
        priceCents: 10000,
        status: "active",
        purchasedAt: new Date(2026, 0, 5).toISOString(),
        createdAt: new Date(2026, 0, 5).toISOString(),
      };
      const packs = [pack2, pack1];
      expect(pickPackToDraw(packs)).toEqual(pack1);
    });
  });

  describe("memberHasPack", () => {
    it("returns false when member has no packs", () => {
      expect(memberHasPack([])).toBe(false);
    });

    it("returns true when member has at least one pack", () => {
      const packs: ClassPack[] = [
        {
          id: "pack1",
          studioId: "studio1",
          memberId: "member1",
          creditsTotal: 5,
          creditsRemaining: 5,
          priceCents: 5000,
          status: "active",
          purchasedAt: new Date(2026, 0, 1).toISOString(),
          createdAt: new Date(2026, 0, 1).toISOString(),
        },
      ];
      expect(memberHasPack(packs)).toBe(true);
    });
  });
});
