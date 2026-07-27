import { describe, it, expect } from "vitest";
import { packPriceCents, pickPackToDraw, hasEverOwnedPack } from "./packages";
import type { Package } from "@/lib/db/types";

describe("packages domain", () => {
  describe("packPriceCents", () => {
    it("returns 5000 for 5 credits", () => {
      expect(packPriceCents(5)).toBe(5000);
    });

    it("returns 10000 for 10 credits", () => {
      expect(packPriceCents(10)).toBe(10000);
    });
  });

  describe("pickPackToDraw", () => {
    it("returns the oldest active pack with credits remaining", () => {
      const packs: Package[] = [
        {
          id: "pkg-1",
          studioId: "studio-1",
          memberId: "member-1",
          creditsTotal: 5,
          creditsRemaining: 3,
          priceCents: 5000,
          status: "active",
          purchasedAt: "2026-07-26T10:00:00Z",
          createdAt: "2026-07-26T10:00:00Z",
        },
        {
          id: "pkg-2",
          studioId: "studio-1",
          memberId: "member-1",
          creditsTotal: 10,
          creditsRemaining: 8,
          priceCents: 10000,
          status: "active",
          purchasedAt: "2026-07-27T10:00:00Z",
          createdAt: "2026-07-27T10:00:00Z",
        },
      ];

      const picked = pickPackToDraw(packs);
      expect(picked?.id).toBe("pkg-1");
    });

    it("skips refunded packs", () => {
      const packs: Package[] = [
        {
          id: "pkg-1",
          studioId: "studio-1",
          memberId: "member-1",
          creditsTotal: 5,
          creditsRemaining: 0,
          priceCents: 5000,
          status: "refunded",
          purchasedAt: "2026-07-26T10:00:00Z",
          createdAt: "2026-07-26T10:00:00Z",
        },
        {
          id: "pkg-2",
          studioId: "studio-1",
          memberId: "member-1",
          creditsTotal: 10,
          creditsRemaining: 8,
          priceCents: 10000,
          status: "active",
          purchasedAt: "2026-07-27T10:00:00Z",
          createdAt: "2026-07-27T10:00:00Z",
        },
      ];

      const picked = pickPackToDraw(packs);
      expect(picked?.id).toBe("pkg-2");
    });

    it("skips exhausted active packs", () => {
      const packs: Package[] = [
        {
          id: "pkg-1",
          studioId: "studio-1",
          memberId: "member-1",
          creditsTotal: 5,
          creditsRemaining: 0,
          priceCents: 5000,
          status: "active",
          purchasedAt: "2026-07-26T10:00:00Z",
          createdAt: "2026-07-26T10:00:00Z",
        },
        {
          id: "pkg-2",
          studioId: "studio-1",
          memberId: "member-1",
          creditsTotal: 10,
          creditsRemaining: 8,
          priceCents: 10000,
          status: "active",
          purchasedAt: "2026-07-27T10:00:00Z",
          createdAt: "2026-07-27T10:00:00Z",
        },
      ];

      const picked = pickPackToDraw(packs);
      expect(picked?.id).toBe("pkg-2");
    });

    it("returns null when no drawable packs exist", () => {
      const packs: Package[] = [
        {
          id: "pkg-1",
          studioId: "studio-1",
          memberId: "member-1",
          creditsTotal: 5,
          creditsRemaining: 0,
          priceCents: 5000,
          status: "active",
          purchasedAt: "2026-07-26T10:00:00Z",
          createdAt: "2026-07-26T10:00:00Z",
        },
      ];

      const picked = pickPackToDraw(packs);
      expect(picked).toBeNull();
    });

    it("returns null when packs array is empty", () => {
      const picked = pickPackToDraw([]);
      expect(picked).toBeNull();
    });
  });

  describe("hasEverOwnedPack", () => {
    it("returns true when member has packs", () => {
      const packs: Package[] = [
        {
          id: "pkg-1",
          studioId: "studio-1",
          memberId: "member-1",
          creditsTotal: 5,
          creditsRemaining: 3,
          priceCents: 5000,
          status: "active",
          purchasedAt: "2026-07-26T10:00:00Z",
          createdAt: "2026-07-26T10:00:00Z",
        },
      ];

      expect(hasEverOwnedPack(packs)).toBe(true);
    });

    it("returns false when member has no packs", () => {
      expect(hasEverOwnedPack([])).toBe(false);
    });
  });
});
