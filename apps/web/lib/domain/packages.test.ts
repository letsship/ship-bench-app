import { describe, it, expect } from "vitest";
import { priceForCredits, pickDrawablePack } from "./packages";
import type { DrawablePack } from "./packages";

describe("packages domain", () => {
  describe("priceForCredits", () => {
    it("computes price: 1000 cents per credit", () => {
      expect(priceForCredits(5)).toBe(5000);
      expect(priceForCredits(10)).toBe(10000);
    });
  });

  describe("pickDrawablePack", () => {
    it("returns null when no packs", () => {
      expect(pickDrawablePack([])).toBeNull();
    });

    it("ignores refunded packs", () => {
      const packs: DrawablePack[] = [
        {
          id: "1",
          creditsRemaining: 5,
          purchasedAt: "2026-01-01T00:00:00Z",
          status: "refunded",
        },
      ];
      expect(pickDrawablePack(packs)).toBeNull();
    });

    it("ignores exhausted active packs", () => {
      const packs: DrawablePack[] = [
        {
          id: "1",
          creditsRemaining: 0,
          purchasedAt: "2026-01-01T00:00:00Z",
          status: "active",
        },
      ];
      expect(pickDrawablePack(packs)).toBeNull();
    });

    it("returns the oldest active pack with credits", () => {
      const old: DrawablePack = {
        id: "1",
        creditsRemaining: 3,
        purchasedAt: "2026-01-01T00:00:00Z",
        status: "active",
      };
      const newer: DrawablePack = {
        id: "2",
        creditsRemaining: 5,
        purchasedAt: "2026-01-02T00:00:00Z",
        status: "active",
      };
      expect(pickDrawablePack([newer, old])).toEqual(old);
      expect(pickDrawablePack([old, newer])).toEqual(old);
    });

    it("skips exhausted and refunded to find the oldest drawable", () => {
      const oldest: DrawablePack = {
        id: "1",
        creditsRemaining: 0,
        purchasedAt: "2026-01-01T00:00:00Z",
        status: "active",
      };
      const middle: DrawablePack = {
        id: "2",
        creditsRemaining: 5,
        purchasedAt: "2026-01-02T00:00:00Z",
        status: "active",
      };
      const newest: DrawablePack = {
        id: "3",
        creditsRemaining: 2,
        purchasedAt: "2026-01-03T00:00:00Z",
        status: "refunded",
      };
      expect(pickDrawablePack([oldest, middle, newest])).toEqual(middle);
    });
  });
});
