import { describe, expect, it } from "vitest";
import {
  type DrawablePack,
  PACK_CREDIT_OPTIONS,
  PRICE_CENTS_PER_CREDIT,
  isDrawable,
  pickDrawablePack,
  priceForCredits,
} from "./packs";

const pack = (id: string, over: Partial<DrawablePack> = {}): DrawablePack => ({
  id,
  status: "active",
  creditsRemaining: 5,
  purchasedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("priceForCredits", () => {
  it("charges 1000 cents per credit as a pack total", () => {
    expect(PRICE_CENTS_PER_CREDIT).toBe(1000);
    expect(priceForCredits(5)).toBe(5000);
    expect(priceForCredits(10)).toBe(10_000);
  });

  it("offers a 5- and a 10-credit pack", () => {
    expect([...PACK_CREDIT_OPTIONS]).toEqual([5, 10]);
  });
});

describe("isDrawable", () => {
  it("accepts an active pack with credits left", () => {
    expect(isDrawable(pack("p1"))).toBe(true);
  });

  it("rejects an exhausted pack and a refunded pack", () => {
    expect(isDrawable(pack("p1", { creditsRemaining: 0 }))).toBe(false);
    expect(isDrawable(pack("p2", { status: "refunded", creditsRemaining: 3 }))).toBe(false);
  });
});

describe("pickDrawablePack", () => {
  it("picks the oldest pack that still has credits", () => {
    const picked = pickDrawablePack([
      pack("newer", { purchasedAt: "2026-03-01T00:00:00.000Z" }),
      pack("older", { purchasedAt: "2026-02-01T00:00:00.000Z" }),
    ]);
    expect(picked?.id).toBe("older");
  });

  it("skips exhausted and refunded packs even when they are older", () => {
    const picked = pickDrawablePack([
      pack("spent", { purchasedAt: "2026-01-01T00:00:00.000Z", creditsRemaining: 0 }),
      pack("refunded", { purchasedAt: "2026-01-02T00:00:00.000Z", status: "refunded" }),
      pack("usable", { purchasedAt: "2026-01-03T00:00:00.000Z" }),
    ]);
    expect(picked?.id).toBe("usable");
  });

  it("returns null when every pack is exhausted or refunded", () => {
    expect(
      pickDrawablePack([
        pack("a", { creditsRemaining: 0 }),
        pack("b", { status: "refunded", creditsRemaining: 4 }),
      ]),
    ).toBeNull();
  });

  it("returns null for no packs at all", () => {
    expect(pickDrawablePack([])).toBeNull();
  });

  it("breaks a purchasedAt tie deterministically", () => {
    const packs = [pack("b"), pack("a")];
    expect(pickDrawablePack(packs)?.id).toBe("a");
    expect(pickDrawablePack([...packs].reverse())?.id).toBe("a");
  });
});
