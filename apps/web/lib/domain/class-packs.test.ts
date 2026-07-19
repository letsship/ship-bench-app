import { describe, it, expect } from "vitest";
import { isDrawable, packPriceCents, pickPackToDraw, refundPatch } from "./class-packs";
import type { ClassPack } from "@/lib/db/types";

describe("class-packs domain", () => {
  it("should calculate pack price cents", () => {
    expect(packPriceCents(5)).toBe(5000);
    expect(packPriceCents(10)).toBe(10000);
  });

  it("should determine if a pack is drawable", () => {
    const activePack: ClassPack = {
      id: "1",
      studioId: "studio",
      memberId: "member",
      creditsTotal: 5,
      creditsRemaining: 3,
      priceCents: 5000,
      status: "active",
      purchasedAt: "2025-01-01T00:00:00Z",
    };
    expect(isDrawable(activePack)).toBe(true);

    const exhaustedPack: ClassPack = {
      ...activePack,
      creditsRemaining: 0,
    };
    expect(isDrawable(exhaustedPack)).toBe(false);

    const refundedPack: ClassPack = {
      ...activePack,
      status: "refunded",
    };
    expect(isDrawable(refundedPack)).toBe(false);
  });

  it("should pick oldest drawable pack first", () => {
    const oldPack: ClassPack = {
      id: "old",
      studioId: "studio",
      memberId: "member",
      creditsTotal: 5,
      creditsRemaining: 2,
      priceCents: 5000,
      status: "active",
      purchasedAt: "2025-01-01T00:00:00Z",
    };
    const newPack: ClassPack = {
      ...oldPack,
      id: "new",
      purchasedAt: "2025-01-02T00:00:00Z",
    };
    const packs = [oldPack, newPack];
    expect(pickPackToDraw(packs)?.id).toBe("old");
  });

  it("should skip exhausted and refunded packs", () => {
    const exhaustedPack: ClassPack = {
      id: "exhausted",
      studioId: "studio",
      memberId: "member",
      creditsTotal: 5,
      creditsRemaining: 0,
      priceCents: 5000,
      status: "active",
      purchasedAt: "2025-01-01T00:00:00Z",
    };
    const drawablePack: ClassPack = {
      id: "drawable",
      studioId: "studio",
      memberId: "member",
      creditsTotal: 5,
      creditsRemaining: 3,
      priceCents: 5000,
      status: "active",
      purchasedAt: "2025-01-02T00:00:00Z",
    };
    const packs = [exhaustedPack, drawablePack];
    expect(pickPackToDraw(packs)?.id).toBe("drawable");
  });

  it("should return null if no drawable pack", () => {
    const refundedPack: ClassPack = {
      id: "refunded",
      studioId: "studio",
      memberId: "member",
      creditsTotal: 5,
      creditsRemaining: 2,
      priceCents: 5000,
      status: "refunded",
      purchasedAt: "2025-01-01T00:00:00Z",
    };
    expect(pickPackToDraw([refundedPack])).toBeNull();
  });

  it("should produce refund patch", () => {
    const patch = refundPatch();
    expect(patch.creditsRemaining).toBe(0);
    expect(patch.status).toBe("refunded");
  });
});
