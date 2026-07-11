import { describe, expect, it } from "vitest";
import { packPriceCents, pickDrawablePack } from "./class-packages";

describe("packPriceCents", () => {
  it("prices a 5-credit pack at 5000 cents", () => {
    expect(packPriceCents(5)).toBe(5000);
  });

  it("prices a 10-credit pack at 10000 cents", () => {
    expect(packPriceCents(10)).toBe(10000);
  });
});

describe("pickDrawablePack", () => {
  it("returns null for an empty list", () => {
    expect(pickDrawablePack([])).toBeNull();
  });

  it("picks the oldest active pack with credits remaining", () => {
    const packs = [
      { id: "p2", status: "active", creditsRemaining: 3, purchasedAt: "2026-02-01T00:00:00Z" },
      { id: "p1", status: "active", creditsRemaining: 5, purchasedAt: "2026-01-01T00:00:00Z" },
    ];
    expect(pickDrawablePack(packs)?.id).toBe("p1");
  });

  it("skips refunded packs", () => {
    const packs = [
      { id: "p1", status: "refunded", creditsRemaining: 5, purchasedAt: "2026-01-01T00:00:00Z" },
      { id: "p2", status: "active", creditsRemaining: 2, purchasedAt: "2026-02-01T00:00:00Z" },
    ];
    expect(pickDrawablePack(packs)?.id).toBe("p2");
  });

  it("skips exhausted packs", () => {
    const packs = [
      { id: "p1", status: "active", creditsRemaining: 0, purchasedAt: "2026-01-01T00:00:00Z" },
    ];
    expect(pickDrawablePack(packs)).toBeNull();
  });

  it("returns null when every pack is exhausted or refunded", () => {
    const packs = [
      { id: "p1", status: "active", creditsRemaining: 0, purchasedAt: "2026-01-01T00:00:00Z" },
      { id: "p2", status: "refunded", creditsRemaining: 4, purchasedAt: "2026-02-01T00:00:00Z" },
    ];
    expect(pickDrawablePack(packs)).toBeNull();
  });
});
