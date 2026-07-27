import { describe, it, expect } from "vitest";
import { packPriceCents, pickPackToDraw, deriveStatusAfterSpend } from "@/lib/domain/class-packs";
import type { ClassPack } from "@/lib/db/types";

describe("class-packs domain", () => {
  describe("packPriceCents", () => {
    it("calculates price for 5-credit pack", () => {
      expect(packPriceCents(5)).toBe(5000);
    });

    it("calculates price for 10-credit pack", () => {
      expect(packPriceCents(10)).toBe(10000);
    });
  });

  describe("pickPackToDraw", () => {
    it("returns the oldest active pack with credits", () => {
      const packs: ClassPack[] = [
        {
          id: "pack-2",
          studioId: "studio",
          memberId: "member",
          creditsTotal: 5,
          creditsRemaining: 3,
          priceCents: 5000,
          status: "active",
          purchasedAt: "2026-07-20T12:00:00Z",
          createdAt: "2026-07-20T12:00:00Z",
        },
        {
          id: "pack-1",
          studioId: "studio",
          memberId: "member",
          creditsTotal: 10,
          creditsRemaining: 2,
          priceCents: 10000,
          status: "active",
          purchasedAt: "2026-07-15T12:00:00Z",
          createdAt: "2026-07-15T12:00:00Z",
        },
      ];
      const result = pickPackToDraw(packs);
      expect(result?.id).toBe("pack-1");
    });

    it("skips exhausted packs", () => {
      const packs: ClassPack[] = [
        {
          id: "pack-1",
          studioId: "studio",
          memberId: "member",
          creditsTotal: 5,
          creditsRemaining: 0,
          priceCents: 5000,
          status: "exhausted",
          purchasedAt: "2026-07-15T12:00:00Z",
          createdAt: "2026-07-15T12:00:00Z",
        },
        {
          id: "pack-2",
          studioId: "studio",
          memberId: "member",
          creditsTotal: 10,
          creditsRemaining: 5,
          priceCents: 10000,
          status: "active",
          purchasedAt: "2026-07-20T12:00:00Z",
          createdAt: "2026-07-20T12:00:00Z",
        },
      ];
      const result = pickPackToDraw(packs);
      expect(result?.id).toBe("pack-2");
    });

    it("skips refunded packs", () => {
      const packs: ClassPack[] = [
        {
          id: "pack-1",
          studioId: "studio",
          memberId: "member",
          creditsTotal: 5,
          creditsRemaining: 0,
          priceCents: 5000,
          status: "refunded",
          purchasedAt: "2026-07-15T12:00:00Z",
          createdAt: "2026-07-15T12:00:00Z",
        },
        {
          id: "pack-2",
          studioId: "studio",
          memberId: "member",
          creditsTotal: 10,
          creditsRemaining: 3,
          priceCents: 10000,
          status: "active",
          purchasedAt: "2026-07-20T12:00:00Z",
          createdAt: "2026-07-20T12:00:00Z",
        },
      ];
      const result = pickPackToDraw(packs);
      expect(result?.id).toBe("pack-2");
    });

    it("skips packs with zero credits remaining", () => {
      const packs: ClassPack[] = [
        {
          id: "pack-1",
          studioId: "studio",
          memberId: "member",
          creditsTotal: 5,
          creditsRemaining: 0,
          priceCents: 5000,
          status: "active",
          purchasedAt: "2026-07-15T12:00:00Z",
          createdAt: "2026-07-15T12:00:00Z",
        },
      ];
      const result = pickPackToDraw(packs);
      expect(result).toBeNull();
    });

    it("returns null when no drawable packs", () => {
      const packs: ClassPack[] = [];
      expect(pickPackToDraw(packs)).toBeNull();
    });
  });

  describe("deriveStatusAfterSpend", () => {
    it("returns exhausted when last credit spent", () => {
      expect(deriveStatusAfterSpend(0)).toBe("exhausted");
    });

    it("returns active when credits remain", () => {
      expect(deriveStatusAfterSpend(5)).toBe("active");
      expect(deriveStatusAfterSpend(1)).toBe("active");
    });
  });
});
