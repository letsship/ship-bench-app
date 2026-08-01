import { describe, expect, it } from "vitest";
import { type DrawablePack, packPriceCents, resolvePackDraw } from "./packs";

const pack = (id: string, over: Partial<DrawablePack> = {}): DrawablePack => ({
  id,
  status: "active",
  creditsRemaining: 5,
  purchasedAt: "2026-03-01T10:00:00.000Z",
  ...over,
});

describe("packPriceCents", () => {
  it("charges 1000 cents per credit as the pack total", () => {
    expect(packPriceCents(5)).toBe(5000);
    expect(packPriceCents(10)).toBe(10000);
  });
});

describe("resolvePackDraw", () => {
  it("returns none for a member who never bought a pack", () => {
    expect(resolvePackDraw([])).toEqual({ kind: "none" });
  });

  it("returns exhausted when every pack is used up or refunded", () => {
    const result = resolvePackDraw([
      pack("p1", { creditsRemaining: 0 }),
      pack("p2", { status: "refunded", creditsRemaining: 3 }),
    ]);
    expect(result).toEqual({ kind: "exhausted" });
  });

  it("draws from the oldest active pack with credits left", () => {
    const result = resolvePackDraw([
      pack("newer", { purchasedAt: "2026-03-02T10:00:00.000Z", creditsRemaining: 10 }),
      pack("older", { purchasedAt: "2026-03-01T10:00:00.000Z", creditsRemaining: 2 }),
    ]);
    expect(result).toEqual({ kind: "draw", packId: "older", creditsRemaining: 2 });
  });

  it("skips refunded and empty packs when choosing", () => {
    const result = resolvePackDraw([
      pack("refunded-oldest", {
        status: "refunded",
        purchasedAt: "2026-02-01T10:00:00.000Z",
        creditsRemaining: 4,
      }),
      pack("empty", { purchasedAt: "2026-02-15T10:00:00.000Z", creditsRemaining: 0 }),
      pack("drawable", { purchasedAt: "2026-03-01T10:00:00.000Z", creditsRemaining: 1 }),
    ]);
    expect(result).toEqual({ kind: "draw", packId: "drawable", creditsRemaining: 1 });
  });
});
