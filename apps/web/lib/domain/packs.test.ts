import { describe, expect, it } from "vitest";
import { memberOwnsAnyPack, packPriceCents, pickDrawablePack } from "./packs";

describe("packPriceCents", () => {
  it("is the pack TOTAL, not the per-credit rate", () => {
    expect(packPriceCents(5)).toBe(5000);
    expect(packPriceCents(10)).toBe(10000);
  });
});

describe("pickDrawablePack", () => {
  it("returns null when the member owns no packs", () => {
    expect(pickDrawablePack([])).toBeNull();
  });

  it("skips refunded and zero-credit packs", () => {
    const packs = [
      { id: "a", status: "refunded", creditsRemaining: 5, purchasedAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", status: "active", creditsRemaining: 0, purchasedAt: "2026-01-02T00:00:00.000Z" },
      { id: "c", status: "active", creditsRemaining: 3, purchasedAt: "2026-01-03T00:00:00.000Z" },
    ];
    expect(pickDrawablePack(packs)?.id).toBe("c");
  });

  it("returns the oldest drawable pack first", () => {
    const packs = [
      {
        id: "newer",
        status: "active",
        creditsRemaining: 2,
        purchasedAt: "2026-02-01T00:00:00.000Z",
      },
      {
        id: "older",
        status: "active",
        creditsRemaining: 4,
        purchasedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    expect(pickDrawablePack(packs)?.id).toBe("older");
  });

  it("returns null when all packs are exhausted or refunded", () => {
    const packs = [
      { id: "a", status: "active", creditsRemaining: 0, purchasedAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", status: "refunded", creditsRemaining: 0, purchasedAt: "2026-01-02T00:00:00.000Z" },
    ];
    expect(pickDrawablePack(packs)).toBeNull();
  });
});

describe("memberOwnsAnyPack", () => {
  it("is false for an empty list and true otherwise", () => {
    expect(memberOwnsAnyPack([])).toBe(false);
    expect(memberOwnsAnyPack([{}])).toBe(true);
  });
});
