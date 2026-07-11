import { describe, expect, it } from "vitest";
import { computePackPriceCents, type DrawablePack, selectDrawablePack } from "./packages";

describe("computePackPriceCents", () => {
  it("prices a 5-credit pack at 5000 cents", () => {
    expect(computePackPriceCents(5)).toBe(5000);
  });

  it("prices a 10-credit pack at 10000 cents", () => {
    expect(computePackPriceCents(10)).toBe(10000);
  });
});

describe("selectDrawablePack", () => {
  const pack = (id: string, over: Partial<DrawablePack> = {}): DrawablePack => ({
    id,
    status: "active",
    creditsRemaining: 5,
    purchasedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  });

  it("returns null when there are no packs", () => {
    expect(selectDrawablePack([])).toBeNull();
  });

  it("returns null when every pack is exhausted or refunded", () => {
    const packs = [
      pack("p1", { creditsRemaining: 0 }),
      pack("p2", { status: "refunded", creditsRemaining: 3 }),
    ];
    expect(selectDrawablePack(packs)).toBeNull();
  });

  it("picks the oldest active pack with credits left", () => {
    const packs = [
      pack("newer", { purchasedAt: "2026-02-01T00:00:00.000Z" }),
      pack("older", { purchasedAt: "2026-01-01T00:00:00.000Z" }),
    ];
    expect(selectDrawablePack(packs)?.id).toBe("older");
  });

  it("skips refunded/exhausted packs even if they're older", () => {
    const packs = [
      pack("exhausted-but-oldest", {
        purchasedAt: "2025-12-01T00:00:00.000Z",
        creditsRemaining: 0,
      }),
      pack("drawable", { purchasedAt: "2026-01-01T00:00:00.000Z" }),
    ];
    expect(selectDrawablePack(packs)?.id).toBe("drawable");
  });
});
