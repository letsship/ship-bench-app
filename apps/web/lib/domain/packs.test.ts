import { describe, expect, it } from "vitest";
import { isDrawable, packPriceCents, pickPackToDraw } from "./packs";

describe("class pack rules", () => {
  it("prices the whole pack at 1000 cents per credit", () => {
    expect(packPriceCents(5)).toBe(5000);
    expect(packPriceCents(10)).toBe(10000);
  });

  it("picks the oldest drawable pack", () => {
    const picked = pickPackToDraw([
      { id: "new", status: "active" as const, creditsRemaining: 3, purchasedAt: "2026-02-01" },
      {
        id: "refunded",
        status: "refunded" as const,
        creditsRemaining: 5,
        purchasedAt: "2025-12-01",
      },
      { id: "empty", status: "active" as const, creditsRemaining: 0, purchasedAt: "2026-01-01" },
      { id: "old", status: "active" as const, creditsRemaining: 1, purchasedAt: "2026-01-15" },
    ]);

    expect(picked?.id).toBe("old");
  });

  it("does not draw exhausted or refunded packs", () => {
    expect(isDrawable({ status: "active", creditsRemaining: 0 })).toBe(false);
    expect(isDrawable({ status: "refunded", creditsRemaining: 5 })).toBe(false);
  });
});
