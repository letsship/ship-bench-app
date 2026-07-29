import { describe, expect, it } from "vitest";
import { packPriceCents, pickPackToDeduct, totalCreditsRemaining } from "./packages";
import type { ClassPack } from "@/lib/db/types";

describe("domain/packages", () => {
  describe("packPriceCents", () => {
    it("prices a 5-pack at 5000 cents", () => {
      expect(packPriceCents(5)).toBe(5000);
    });

    it("prices a 10-pack at 10000 cents", () => {
      expect(packPriceCents(10)).toBe(10000);
    });
  });

  describe("pickPackToDeduct", () => {
    const makePackWithCredits = (credits: number, createdAt: string): ClassPack => ({
      id: `pack-${credits}`,
      studioId: "studio-1",
      memberId: "member-1",
      credits,
      creditsRemaining: credits,
      priceCents: credits * 1000,
      status: "active",
      createdAt,
    });

    it("returns the oldest pack when all have credits", () => {
      const olderPack = makePackWithCredits(5, "2026-01-01T00:00:00Z");
      const newerPack = makePackWithCredits(10, "2026-01-02T00:00:00Z");
      expect(pickPackToDeduct([olderPack, newerPack])).toBe(olderPack);
    });

    it("skips empty packs and returns the oldest non-empty pack", () => {
      const emptyPack = makePackWithCredits(5, "2026-01-01T00:00:00Z");
      emptyPack.creditsRemaining = 0;
      const nonEmptyPack = makePackWithCredits(10, "2026-01-02T00:00:00Z");
      expect(pickPackToDeduct([emptyPack, nonEmptyPack])).toBe(nonEmptyPack);
    });

    it("returns null when all packs are empty", () => {
      const emptyPack1 = makePackWithCredits(5, "2026-01-01T00:00:00Z");
      emptyPack1.creditsRemaining = 0;
      const emptyPack2 = makePackWithCredits(10, "2026-01-02T00:00:00Z");
      emptyPack2.creditsRemaining = 0;
      expect(pickPackToDeduct([emptyPack1, emptyPack2])).toBeNull();
    });

    it("returns null when given an empty array", () => {
      expect(pickPackToDeduct([])).toBeNull();
    });
  });

  describe("totalCreditsRemaining", () => {
    const now = new Date().toISOString();
    const makePack = (credits: number): ClassPack => ({
      id: `pack-${credits}`,
      studioId: "studio-1",
      memberId: "member-1",
      credits,
      creditsRemaining: credits,
      priceCents: credits * 1000,
      status: "active",
      createdAt: now,
    });

    it("sums credits from multiple packs", () => {
      const pack5 = makePack(5);
      const pack10 = makePack(10);
      expect(totalCreditsRemaining([pack5, pack10])).toBe(15);
    });

    it("counts partial remaining credits", () => {
      const pack = makePack(10);
      pack.creditsRemaining = 7;
      expect(totalCreditsRemaining([pack])).toBe(7);
    });

    it("returns 0 for empty array", () => {
      expect(totalCreditsRemaining([])).toBe(0);
    });
  });
});
