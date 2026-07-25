import { describe, it, expect } from "vitest";
import { drawFromPack, memberOwnsAnyPack, packPriceCents, pickDrawablePack } from "./packages";
import type { ClassPack } from "@/lib/db/types";

describe("domain/packages", () => {
  describe("packPriceCents", () => {
    it("calculates total price for 5-credit pack", () => {
      expect(packPriceCents(5)).toBe(5000);
    });

    it("calculates total price for 10-credit pack", () => {
      expect(packPriceCents(10)).toBe(10000);
    });
  });

  describe("memberOwnsAnyPack", () => {
    it("returns false when no packs", () => {
      expect(memberOwnsAnyPack([])).toBe(false);
    });

    it("returns true when member has packs", () => {
      const pack: ClassPack = {
        id: "1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 5,
        priceCents: 5000,
        status: "active",
        purchasedAt: "2026-07-25T00:00:00Z",
        createdAt: "2026-07-25T00:00:00Z",
      };
      expect(memberOwnsAnyPack([pack])).toBe(true);
    });
  });

  describe("pickDrawablePack", () => {
    it("returns null when no packs", () => {
      expect(pickDrawablePack([])).toBeNull();
    });

    it("returns oldest active pack with credits", () => {
      const older: ClassPack = {
        id: "1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 2,
        priceCents: 5000,
        status: "active",
        purchasedAt: "2026-07-25T00:00:00Z",
        createdAt: "2026-07-25T00:00:00Z",
      };
      const newer: ClassPack = {
        id: "2",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 10,
        creditsRemaining: 5,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2026-07-26T00:00:00Z",
        createdAt: "2026-07-26T00:00:00Z",
      };
      expect(pickDrawablePack([newer, older])).toEqual(older);
    });

    it("skips exhausted packs", () => {
      const exhausted: ClassPack = {
        id: "1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 0,
        priceCents: 5000,
        status: "exhausted",
        purchasedAt: "2026-07-25T00:00:00Z",
        createdAt: "2026-07-25T00:00:00Z",
      };
      const active: ClassPack = {
        id: "2",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 10,
        creditsRemaining: 5,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2026-07-26T00:00:00Z",
        createdAt: "2026-07-26T00:00:00Z",
      };
      expect(pickDrawablePack([exhausted, active])).toEqual(active);
    });

    it("skips refunded packs", () => {
      const refunded: ClassPack = {
        id: "1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 0,
        priceCents: 5000,
        status: "refunded",
        purchasedAt: "2026-07-25T00:00:00Z",
        createdAt: "2026-07-25T00:00:00Z",
      };
      const active: ClassPack = {
        id: "2",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 10,
        creditsRemaining: 5,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2026-07-26T00:00:00Z",
        createdAt: "2026-07-26T00:00:00Z",
      };
      expect(pickDrawablePack([refunded, active])).toEqual(active);
    });

    it("returns null when all packs are empty", () => {
      const packs: ClassPack[] = [
        {
          id: "1",
          studioId: "s1",
          memberId: "m1",
          creditsTotal: 5,
          creditsRemaining: 0,
          priceCents: 5000,
          status: "exhausted",
          purchasedAt: "2026-07-25T00:00:00Z",
          createdAt: "2026-07-25T00:00:00Z",
        },
        {
          id: "2",
          studioId: "s1",
          memberId: "m1",
          creditsTotal: 10,
          creditsRemaining: 0,
          priceCents: 10000,
          status: "exhausted",
          purchasedAt: "2026-07-26T00:00:00Z",
          createdAt: "2026-07-26T00:00:00Z",
        },
      ];
      expect(pickDrawablePack(packs)).toBeNull();
    });
  });

  describe("drawFromPack", () => {
    it("decrements credits and keeps status active when not zero", () => {
      const pack: ClassPack = {
        id: "1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 3,
        priceCents: 5000,
        status: "active",
        purchasedAt: "2026-07-25T00:00:00Z",
        createdAt: "2026-07-25T00:00:00Z",
      };
      const result = drawFromPack(pack);
      expect(result).toEqual({ creditsRemaining: 2, status: "active" });
    });

    it("flips status to exhausted when reaching zero", () => {
      const pack: ClassPack = {
        id: "1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 5,
        creditsRemaining: 1,
        priceCents: 5000,
        status: "active",
        purchasedAt: "2026-07-25T00:00:00Z",
        createdAt: "2026-07-25T00:00:00Z",
      };
      const result = drawFromPack(pack);
      expect(result).toEqual({ creditsRemaining: 0, status: "exhausted" });
    });
  });
});
