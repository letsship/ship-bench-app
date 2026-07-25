import { describe, it, expect } from "vitest";
import type { ClassPack } from "@/lib/db/types";
import { packPriceCents, memberHasAnyPack, selectPackToSpend } from "./packages";

describe("packages domain", () => {
  describe("packPriceCents", () => {
    it("computes 5 credits as 5000 cents", () => {
      expect(packPriceCents(5)).toBe(5000);
    });

    it("computes 10 credits as 10000 cents", () => {
      expect(packPriceCents(10)).toBe(10000);
    });
  });

  describe("memberHasAnyPack", () => {
    it("returns false for empty pack list", () => {
      expect(memberHasAnyPack([])).toBe(false);
    });

    it("returns true when member has at least one pack", () => {
      const pack: ClassPack = {
        id: "1",
        studioId: "studio-1",
        memberId: "member-1",
        creditsTotal: 5,
        creditsRemaining: 5,
        priceCents: 5000,
        status: "active",
        purchasedAt: "2026-01-01T00:00:00Z",
      };
      expect(memberHasAnyPack([pack])).toBe(true);
    });

    it("returns true when member has any pack, even if refunded", () => {
      const pack: ClassPack = {
        id: "1",
        studioId: "studio-1",
        memberId: "member-1",
        creditsTotal: 5,
        creditsRemaining: 0,
        priceCents: 5000,
        status: "refunded",
        purchasedAt: "2026-01-01T00:00:00Z",
      };
      expect(memberHasAnyPack([pack])).toBe(true);
    });
  });

  describe("selectPackToSpend", () => {
    it("returns null when no active pack with credits exists", () => {
      expect(selectPackToSpend([])).toBe(null);

      const refundedPack: ClassPack = {
        id: "1",
        studioId: "studio-1",
        memberId: "member-1",
        creditsTotal: 5,
        creditsRemaining: 0,
        priceCents: 5000,
        status: "refunded",
        purchasedAt: "2026-01-01T00:00:00Z",
      };
      expect(selectPackToSpend([refundedPack])).toBe(null);

      const emptied: ClassPack = {
        id: "2",
        studioId: "studio-1",
        memberId: "member-1",
        creditsTotal: 5,
        creditsRemaining: 0,
        priceCents: 5000,
        status: "active",
        purchasedAt: "2026-01-02T00:00:00Z",
      };
      expect(selectPackToSpend([emptied])).toBe(null);
    });

    it("selects an active pack with credits", () => {
      const pack: ClassPack = {
        id: "1",
        studioId: "studio-1",
        memberId: "member-1",
        creditsTotal: 5,
        creditsRemaining: 3,
        priceCents: 5000,
        status: "active",
        purchasedAt: "2026-01-01T00:00:00Z",
      };
      expect(selectPackToSpend([pack])).toBe(pack);
    });

    it("selects the oldest active pack with credits", () => {
      const older: ClassPack = {
        id: "1",
        studioId: "studio-1",
        memberId: "member-1",
        creditsTotal: 5,
        creditsRemaining: 2,
        priceCents: 5000,
        status: "active",
        purchasedAt: "2026-01-01T00:00:00Z",
      };
      const newer: ClassPack = {
        id: "2",
        studioId: "studio-1",
        memberId: "member-1",
        creditsTotal: 10,
        creditsRemaining: 8,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2026-01-05T00:00:00Z",
      };
      expect(selectPackToSpend([newer, older])).toBe(older);
      expect(selectPackToSpend([older, newer])).toBe(older);
    });

    it("skips refunded packs, even if they have credits", () => {
      const refunded: ClassPack = {
        id: "1",
        studioId: "studio-1",
        memberId: "member-1",
        creditsTotal: 5,
        creditsRemaining: 5,
        priceCents: 5000,
        status: "refunded",
        purchasedAt: "2026-01-01T00:00:00Z",
      };
      const active: ClassPack = {
        id: "2",
        studioId: "studio-1",
        memberId: "member-1",
        creditsTotal: 10,
        creditsRemaining: 8,
        priceCents: 10000,
        status: "active",
        purchasedAt: "2026-01-05T00:00:00Z",
      };
      expect(selectPackToSpend([refunded, active])).toBe(active);
    });
  });
});
