import { describe, expect, it } from "vitest";
import {
  type PackLike,
  PACK_SIZES,
  PRICE_PER_CREDIT_CENTS,
  isDrawable,
  isValidPackSize,
  memberOwnsAnyPack,
  pickDrawablePack,
  priceForCredits,
} from "./packages";

const pack = (over: Partial<PackLike> = {}): PackLike => ({
  id: "p1",
  creditsRemaining: 5,
  status: "active",
  purchasedAt: "2026-03-15T12:00:00.000Z",
  ...over,
});

describe("priceForCredits", () => {
  it("prices a 5-credit pack at 5000 and a 10-credit pack at 10000 (total)", () => {
    expect(priceForCredits(5)).toBe(5000);
    expect(priceForCredits(10)).toBe(10000);
  });

  it("is credits × the per-credit rate", () => {
    expect(priceForCredits(7)).toBe(7 * PRICE_PER_CREDIT_CENTS);
  });
});

describe("isValidPackSize", () => {
  it("accepts only 5 and 10", () => {
    expect(PACK_SIZES).toEqual([5, 10]);
    expect(isValidPackSize(5)).toBe(true);
    expect(isValidPackSize(10)).toBe(true);
    expect(isValidPackSize(1)).toBe(false);
    expect(isValidPackSize(0)).toBe(false);
    expect(isValidPackSize(11)).toBe(false);
  });
});

describe("isDrawable", () => {
  it("draws an active pack with remaining credits", () => {
    expect(isDrawable(pack({ creditsRemaining: 3 }))).toBe(true);
  });

  it("never draws an exhausted active pack", () => {
    expect(isDrawable(pack({ creditsRemaining: 0 }))).toBe(false);
  });

  it("never draws a refunded pack, even with credits left", () => {
    expect(isDrawable(pack({ creditsRemaining: 4, status: "refunded" }))).toBe(false);
  });
});

describe("pickDrawablePack", () => {
  const older = pack({ id: "older", purchasedAt: "2026-01-01T00:00:00.000Z" });
  const newer = pack({ id: "newer", purchasedAt: "2026-06-01T00:00:00.000Z" });

  it("picks the oldest active pack with credits remaining", () => {
    expect(pickDrawablePack([newer, older])?.id).toBe("older");
  });

  it("returns null when every pack is exhausted", () => {
    expect(pickDrawablePack([pack({ creditsRemaining: 0 })])).toBeNull();
  });

  it("returns null when every pack is refunded", () => {
    expect(pickDrawablePack([pack({ status: "refunded" })])).toBeNull();
  });

  it("skips refunded packs even if they are the oldest", () => {
    const refundedOld = pack({
      id: "refundedOld",
      purchasedAt: "2025-01-01T00:00:00.000Z",
      status: "refunded",
      creditsRemaining: 5,
    });
    expect(pickDrawablePack([refundedOld, newer])?.id).toBe("newer");
  });

  it("returns null for an empty list", () => {
    expect(pickDrawablePack([])).toBeNull();
  });
});

describe("memberOwnsAnyPack", () => {
  it("is false when the member has never bought a pack", () => {
    expect(memberOwnsAnyPack([])).toBe(false);
  });

  it("is true once the member owns at least one pack (even if exhausted)", () => {
    expect(memberOwnsAnyPack([pack({ creditsRemaining: 0 })])).toBe(true);
    expect(memberOwnsAnyPack([pack({ status: "refunded" })])).toBe(true);
  });
});
