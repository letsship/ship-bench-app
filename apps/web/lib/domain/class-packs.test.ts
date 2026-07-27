import { describe, expect, it } from "vitest";
import type { ClassPack } from "../db/types";
import { hasAnyPack, pickPackToDraw, priceForCredits } from "./class-packs";

function pack(id: string, overrides: Partial<ClassPack> = {}): ClassPack {
  return {
    id,
    studioId: "s1",
    memberId: "m1",
    creditsTotal: 5,
    creditsRemaining: 5,
    priceCents: 5000,
    status: "active",
    purchasedAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("priceForCredits", () => {
  it("prices a 5-credit pack at 5000 cents", () => {
    expect(priceForCredits(5)).toBe(5000);
  });

  it("prices a 10-credit pack at 10000 cents", () => {
    expect(priceForCredits(10)).toBe(10000);
  });
});

describe("hasAnyPack", () => {
  it("is false with no packs", () => {
    expect(hasAnyPack([])).toBe(false);
  });

  it("is true with at least one pack", () => {
    expect(hasAnyPack([pack("p1")])).toBe(true);
  });
});

describe("pickPackToDraw", () => {
  it("returns null when there are no packs", () => {
    expect(pickPackToDraw([])).toBeNull();
  });

  it("returns the oldest drawable pack", () => {
    const older = pack("p1", { purchasedAt: "2026-01-01T00:00:00Z" });
    const newer = pack("p2", { purchasedAt: "2026-02-01T00:00:00Z" });
    expect(pickPackToDraw([newer, older])).toEqual(older);
  });

  it("skips exhausted packs", () => {
    const exhausted = pack("p1", { creditsRemaining: 0, purchasedAt: "2026-01-01T00:00:00Z" });
    const drawable = pack("p2", { purchasedAt: "2026-02-01T00:00:00Z" });
    expect(pickPackToDraw([exhausted, drawable])).toEqual(drawable);
  });

  it("skips refunded packs", () => {
    const refunded = pack("p1", { status: "refunded", purchasedAt: "2026-01-01T00:00:00Z" });
    const drawable = pack("p2", { purchasedAt: "2026-02-01T00:00:00Z" });
    expect(pickPackToDraw([refunded, drawable])).toEqual(drawable);
  });

  it("returns null when every pack is exhausted or refunded", () => {
    const exhausted = pack("p1", { creditsRemaining: 0 });
    const refunded = pack("p2", { status: "refunded" });
    expect(pickPackToDraw([exhausted, refunded])).toBeNull();
  });
});
