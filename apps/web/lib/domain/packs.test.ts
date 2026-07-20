import { describe, expect, it } from "vitest";
import type { ClassPack } from "@/lib/db/types";
import { memberHasPurchasedPack, packPriceCents, pickPackToDraw } from "./packs";

const ISO = new Date().toISOString();

const pack = (id: string, over: Partial<ClassPack> = {}): ClassPack => ({
  id,
  studioId: "s1",
  memberId: "m1",
  creditsTotal: 5,
  creditsRemaining: 5,
  priceCents: 5000,
  status: "active",
  purchasedAt: ISO,
  createdAt: ISO,
  ...over,
});

describe("packs domain", () => {
  describe("packPriceCents", () => {
    it("calculates 5000 cents for 5 credits", () => {
      expect(packPriceCents(5)).toBe(5000);
    });

    it("calculates 10000 cents for 10 credits", () => {
      expect(packPriceCents(10)).toBe(10000);
    });
  });

  describe("memberHasPurchasedPack", () => {
    it("returns true when packs exist", () => {
      expect(memberHasPurchasedPack([pack("p1")])).toBe(true);
    });

    it("returns false when no packs exist", () => {
      expect(memberHasPurchasedPack([])).toBe(false);
    });
  });

  describe("pickPackToDraw", () => {
    it("returns oldest active pack with credits", () => {
      const older = pack("p1", { purchasedAt: "2026-01-01T00:00:00Z", creditsRemaining: 1 });
      const newer = pack("p2", { purchasedAt: "2026-01-02T00:00:00Z", creditsRemaining: 2 });
      const result = pickPackToDraw([newer, older]);
      expect(result?.id).toBe("p1");
    });

    it("skips exhausted packs", () => {
      const exhausted = pack("p1", { purchasedAt: "2026-01-01T00:00:00Z", creditsRemaining: 0 });
      const available = pack("p2", { purchasedAt: "2026-01-02T00:00:00Z", creditsRemaining: 1 });
      const result = pickPackToDraw([available, exhausted]);
      expect(result?.id).toBe("p2");
    });

    it("skips refunded packs", () => {
      const refunded = pack("p1", {
        purchasedAt: "2026-01-01T00:00:00Z",
        status: "refunded",
        creditsRemaining: 5,
      });
      const available = pack("p2", { purchasedAt: "2026-01-02T00:00:00Z", creditsRemaining: 1 });
      const result = pickPackToDraw([available, refunded]);
      expect(result?.id).toBe("p2");
    });

    it("returns null when no drawable packs", () => {
      const exhausted = pack("p1", { creditsRemaining: 0 });
      const refunded = pack("p2", { status: "refunded" });
      const result = pickPackToDraw([exhausted, refunded]);
      expect(result).toBeNull();
    });

    it("returns null when packs are empty", () => {
      expect(pickPackToDraw([])).toBeNull();
    });
  });
});
