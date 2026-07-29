import { describe, expect, it } from "vitest";
import { CREDIT_PRICE_CENTS, packPriceCents, pickDrawablePack } from "./packs";
import type { ClassPack } from "@/lib/db/types";

function pack(over: Partial<ClassPack> = {}): ClassPack {
  return {
    id: "p1",
    memberId: "m1",
    creditsTotal: 10,
    creditsRemaining: 5,
    priceCents: 10000,
    status: "active",
    purchasedAt: "2026-07-01T10:00:00.000Z",
    ...over,
  };
}

describe("packPriceCents", () => {
  it("prices a 5-credit pack at 5000", () => {
    expect(packPriceCents(5)).toBe(5000);
  });

  it("prices a 10-credit pack at 10000", () => {
    expect(packPriceCents(10)).toBe(10000);
  });

  it("uses the CREDIT_PRICE_CENTS constant", () => {
    expect(CREDIT_PRICE_CENTS).toBe(1000);
  });
});

describe("pickDrawablePack", () => {
  it("returns the oldest active pack with credits remaining", () => {
    const packs = [
      pack({ id: "p1", creditsRemaining: 0, purchasedAt: "2026-06-01T10:00:00.000Z" }),
      pack({ id: "p2", creditsRemaining: 3, purchasedAt: "2026-07-01T10:00:00.000Z" }),
      pack({ id: "p3", creditsRemaining: 5, purchasedAt: "2026-05-01T10:00:00.000Z" }),
    ];
    expect(pickDrawablePack(packs)?.id).toBe("p3");
  });

  it("skips packs with creditsRemaining of 0", () => {
    const packs = [
      pack({ id: "p1", creditsRemaining: 0, purchasedAt: "2026-06-01T10:00:00.000Z" }),
      pack({ id: "p2", creditsRemaining: 2, purchasedAt: "2026-07-01T10:00:00.000Z" }),
    ];
    expect(pickDrawablePack(packs)?.id).toBe("p2");
  });

  it("skips refunded packs even if they have credits remaining", () => {
    const packs = [
      pack({ id: "p1", creditsRemaining: 3, status: "refunded", purchasedAt: "2026-06-01T10:00:00.000Z" }),
      pack({ id: "p2", creditsRemaining: 2, status: "active", purchasedAt: "2026-07-01T10:00:00.000Z" }),
    ];
    expect(pickDrawablePack(packs)?.id).toBe("p2");
  });

  it("returns null when no drawable pack exists", () => {
    expect(pickDrawablePack([])).toBeNull();
    expect(pickDrawablePack([pack({ creditsRemaining: 0 })])).toBeNull();
    expect(pickDrawablePack([pack({ status: "refunded", creditsRemaining: 5 })])).toBeNull();
  });
});