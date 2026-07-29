import { describe, expect, it } from "vitest";
import type { ClassPack } from "@/lib/db/types";
import {
  memberRequiresPack,
  packPriceCents,
  selectPackToDraw,
} from "./packages";

function pack(over: Partial<ClassPack> = {}): ClassPack {
  return {
    id: "p1",
    studioId: "s1",
    memberId: "m1",
    creditsTotal: 5,
    creditsRemaining: 5,
    priceCents: 5000,
    status: "active",
    purchasedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("packPriceCents", () => {
  it("prices a 5-credit pack at 5000 cents", () => {
    expect(packPriceCents(5)).toBe(5000);
  });

  it("prices a 10-credit pack at 10000 cents", () => {
    expect(packPriceCents(10)).toBe(10000);
  });
});

describe("selectPackToDraw", () => {
  it("returns the only active pack with credits", () => {
    const packs = [pack({ id: "p1", creditsRemaining: 3 })];
    expect(selectPackToDraw(packs)?.id).toBe("p1");
  });

  it("picks the oldest active pack with credits first", () => {
    const packs = [
      pack({ id: "new", purchasedAt: "2026-02-01T00:00:00.000Z", creditsRemaining: 2 }),
      pack({ id: "old", purchasedAt: "2026-01-01T00:00:00.000Z", creditsRemaining: 1 }),
    ];
    expect(selectPackToDraw(packs)?.id).toBe("old");
  });

  it("skips exhausted packs (creditsRemaining 0)", () => {
    const packs = [
      pack({ id: "empty", creditsRemaining: 0 }),
      pack({ id: "full", creditsRemaining: 4 }),
    ];
    expect(selectPackToDraw(packs)?.id).toBe("full");
  });

  it("skips refunded packs", () => {
    const packs = [
      pack({ id: "refunded", status: "refunded", creditsRemaining: 3 }),
      pack({ id: "active", creditsRemaining: 2 }),
    ];
    expect(selectPackToDraw(packs)?.id).toBe("active");
  });

  it("returns null when no pack is drawable", () => {
    const packs = [
      pack({ id: "empty", creditsRemaining: 0 }),
      pack({ id: "refunded", status: "refunded", creditsRemaining: 0 }),
    ];
    expect(selectPackToDraw(packs)).toBeNull();
  });

  it("returns null for an empty pack list", () => {
    expect(selectPackToDraw([])).toBeNull();
  });
});

describe("memberRequiresPack", () => {
  it("is false when the member has never bought a pack", () => {
    expect(memberRequiresPack([])).toBe(false);
  });

  it("is true when the member owns any pack (even refunded)", () => {
    expect(memberRequiresPack([pack({ status: "refunded", creditsRemaining: 0 })])).toBe(true);
  });
});
