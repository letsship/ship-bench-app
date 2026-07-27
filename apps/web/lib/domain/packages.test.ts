import { describe, it, expect } from "vitest";
import { priceForCredits, pickDrawablePack } from "./packages";
import type { Package } from "@/lib/db/types";

describe("packages domain", () => {
  describe("priceForCredits", () => {
    it("returns 1000 cents per credit", () => {
      expect(priceForCredits(5)).toBe(5000);
      expect(priceForCredits(10)).toBe(10000);
    });
  });

  describe("pickDrawablePack", () => {
    it("returns the oldest active pack with credits remaining", () => {
      const packs: Package[] = [
        {
          id: "pkg1",
          studioId: "studio1",
          memberId: "member1",
          creditsTotal: 5,
          creditsRemaining: 3,
          priceCents: 5000,
          status: "active",
          purchasedAt: "2026-07-01T12:00:00Z",
        },
        {
          id: "pkg2",
          studioId: "studio1",
          memberId: "member1",
          creditsTotal: 10,
          creditsRemaining: 5,
          priceCents: 10000,
          status: "active",
          purchasedAt: "2026-07-02T12:00:00Z",
        },
      ];
      const picked = pickDrawablePack(packs);
      expect(picked?.id).toBe("pkg1");
    });

    it("skips refunded packs", () => {
      const packs: Package[] = [
        {
          id: "pkg1",
          studioId: "studio1",
          memberId: "member1",
          creditsTotal: 5,
          creditsRemaining: 0,
          priceCents: 5000,
          status: "refunded",
          purchasedAt: "2026-07-01T12:00:00Z",
        },
        {
          id: "pkg2",
          studioId: "studio1",
          memberId: "member1",
          creditsTotal: 10,
          creditsRemaining: 5,
          priceCents: 10000,
          status: "active",
          purchasedAt: "2026-07-02T12:00:00Z",
        },
      ];
      const picked = pickDrawablePack(packs);
      expect(picked?.id).toBe("pkg2");
    });

    it("skips packs with zero credits remaining", () => {
      const packs: Package[] = [
        {
          id: "pkg1",
          studioId: "studio1",
          memberId: "member1",
          creditsTotal: 5,
          creditsRemaining: 0,
          priceCents: 5000,
          status: "active",
          purchasedAt: "2026-07-01T12:00:00Z",
        },
        {
          id: "pkg2",
          studioId: "studio1",
          memberId: "member1",
          creditsTotal: 10,
          creditsRemaining: 5,
          priceCents: 10000,
          status: "active",
          purchasedAt: "2026-07-02T12:00:00Z",
        },
      ];
      const picked = pickDrawablePack(packs);
      expect(picked?.id).toBe("pkg2");
    });

    it("returns null when no drawable packs exist", () => {
      const packs: Package[] = [
        {
          id: "pkg1",
          studioId: "studio1",
          memberId: "member1",
          creditsTotal: 5,
          creditsRemaining: 0,
          priceCents: 5000,
          status: "active",
          purchasedAt: "2026-07-01T12:00:00Z",
        },
      ];
      const picked = pickDrawablePack(packs);
      expect(picked).toBeNull();
    });

    it("returns null for empty pack list", () => {
      const picked = pickDrawablePack([]);
      expect(picked).toBeNull();
    });
  });
});
