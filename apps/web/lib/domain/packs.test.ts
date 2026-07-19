import { describe, it, expect } from "vitest";
import type { ClassPack } from "@/lib/db/types";
import {
  PRICE_PER_CREDIT_CENTS,
  isDrawable,
  packPriceCents,
  pickPackToSpend,
  refundedPackPatch,
  spendCredit,
} from "./packs";

describe("pack domain rules", () => {
  describe("packPriceCents", () => {
    it("calculates 5-credit pack price as 5000", () => {
      expect(packPriceCents(5)).toBe(5000);
    });

    it("calculates 10-credit pack price as 10000", () => {
      expect(packPriceCents(10)).toBe(10000);
    });

    it("uses PRICE_PER_CREDIT_CENTS constant", () => {
      expect(packPriceCents(1)).toBe(PRICE_PER_CREDIT_CENTS);
    });
  });

  describe("isDrawable", () => {
    it("returns true for active pack with remaining credits", () => {
      const pack: ClassPack = {
        id: "p1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 10,
        creditsRemaining: 5,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2026-07-01T00:00:00Z",
      };
      expect(isDrawable(pack)).toBe(true);
    });

    it("returns false for exhausted pack", () => {
      const pack: ClassPack = {
        id: "p1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 10,
        creditsRemaining: 0,
        priceCents: 10000,
        status: "exhausted",
        purchasedAt: "2026-07-01T00:00:00Z",
      };
      expect(isDrawable(pack)).toBe(false);
    });

    it("returns false for refunded pack", () => {
      const pack: ClassPack = {
        id: "p1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 10,
        creditsRemaining: 0,
        priceCents: 10000,
        status: "refunded",
        purchasedAt: "2026-07-01T00:00:00Z",
      };
      expect(isDrawable(pack)).toBe(false);
    });

    it("returns false for active pack with no remaining credits", () => {
      const pack: ClassPack = {
        id: "p1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 10,
        creditsRemaining: 0,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2026-07-01T00:00:00Z",
      };
      expect(isDrawable(pack)).toBe(false);
    });
  });

  describe("pickPackToSpend", () => {
    it("returns oldest drawable pack first", () => {
      const packs: ClassPack[] = [
        {
          id: "p2",
          studioId: "s1",
          memberId: "m1",
          creditsTotal: 10,
          creditsRemaining: 5,
          priceCents: 10000,
          status: "active",
          purchasedAt: "2026-07-02T00:00:00Z",
        },
        {
          id: "p1",
          studioId: "s1",
          memberId: "m1",
          creditsTotal: 5,
          creditsRemaining: 3,
          priceCents: 5000,
          status: "active",
          purchasedAt: "2026-07-01T00:00:00Z",
        },
      ];
      expect(pickPackToSpend(packs)?.id).toBe("p1");
    });

    it("ignores refunded packs", () => {
      const packs: ClassPack[] = [
        {
          id: "p1",
          studioId: "s1",
          memberId: "m1",
          creditsTotal: 10,
          creditsRemaining: 0,
          priceCents: 10000,
          status: "refunded",
          purchasedAt: "2026-07-01T00:00:00Z",
        },
        {
          id: "p2",
          studioId: "s1",
          memberId: "m1",
          creditsTotal: 10,
          creditsRemaining: 5,
          priceCents: 10000,
          status: "active",
          purchasedAt: "2026-07-02T00:00:00Z",
        },
      ];
      expect(pickPackToSpend(packs)?.id).toBe("p2");
    });

    it("ignores exhausted packs", () => {
      const packs: ClassPack[] = [
        {
          id: "p1",
          studioId: "s1",
          memberId: "m1",
          creditsTotal: 10,
          creditsRemaining: 0,
          priceCents: 10000,
          status: "exhausted",
          purchasedAt: "2026-07-01T00:00:00Z",
        },
        {
          id: "p2",
          studioId: "s1",
          memberId: "m1",
          creditsTotal: 10,
          creditsRemaining: 5,
          priceCents: 10000,
          status: "active",
          purchasedAt: "2026-07-02T00:00:00Z",
        },
      ];
      expect(pickPackToSpend(packs)?.id).toBe("p2");
    });

    it("returns null when no drawable packs", () => {
      const packs: ClassPack[] = [
        {
          id: "p1",
          studioId: "s1",
          memberId: "m1",
          creditsTotal: 10,
          creditsRemaining: 0,
          priceCents: 10000,
          status: "exhausted",
          purchasedAt: "2026-07-01T00:00:00Z",
        },
      ];
      expect(pickPackToSpend(packs)).toBe(null);
    });
  });

  describe("spendCredit", () => {
    it("decrements creditsRemaining by one", () => {
      const pack: ClassPack = {
        id: "p1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 10,
        creditsRemaining: 5,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2026-07-01T00:00:00Z",
      };
      const result = spendCredit(pack);
      expect(result.creditsRemaining).toBe(4);
    });

    it("transitions to exhausted at zero", () => {
      const pack: ClassPack = {
        id: "p1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 10,
        creditsRemaining: 1,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2026-07-01T00:00:00Z",
      };
      const result = spendCredit(pack);
      expect(result.creditsRemaining).toBe(0);
      expect(result.status).toBe("exhausted");
    });

    it("keeps status as active when credits remain", () => {
      const pack: ClassPack = {
        id: "p1",
        studioId: "s1",
        memberId: "m1",
        creditsTotal: 10,
        creditsRemaining: 5,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2026-07-01T00:00:00Z",
      };
      const result = spendCredit(pack);
      expect(result.status).toBe("active");
    });
  });

  describe("refundedPackPatch", () => {
    it("voids all remaining credits", () => {
      const patch = refundedPackPatch();
      expect(patch.creditsRemaining).toBe(0);
    });

    it("sets status to refunded", () => {
      const patch = refundedPackPatch();
      expect(patch.status).toBe("refunded");
    });
  });
});
