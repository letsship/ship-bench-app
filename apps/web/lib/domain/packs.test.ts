import { describe, expect, it } from "vitest";
import {
  ALLOWED_PACK_CREDITS,
  PRICE_CENTS_PER_CREDIT,
  type PackLike,
  decidePackDraw,
  priceForCredits,
} from "./packs";

const pack = (id: string, over: Partial<PackLike> = {}): PackLike => ({
  id,
  status: "active",
  creditsRemaining: 3,
  purchasedAt: "2026-01-01T10:00:00.000Z",
  ...over,
});

describe("pack pricing", () => {
  it("sells credits at 1000 cents each", () => {
    expect(PRICE_CENTS_PER_CREDIT).toBe(1000);
    expect(ALLOWED_PACK_CREDITS).toEqual([5, 10]);
  });

  it("prices the pack TOTAL (credits × 1000)", () => {
    expect(priceForCredits(5)).toBe(5000);
    expect(priceForCredits(10)).toBe(10000);
  });
});

describe("decidePackDraw", () => {
  it("returns no_pack when the member owns zero packs", () => {
    expect(decidePackDraw([])).toEqual({ kind: "no_pack" });
  });

  it("draws from an active pack with credits", () => {
    expect(decidePackDraw([pack("p1")])).toEqual({ kind: "draw", packId: "p1" });
  });

  it("draws from the oldest pack first", () => {
    const newer = pack("p_new", { purchasedAt: "2026-02-01T10:00:00.000Z" });
    const older = pack("p_old", { purchasedAt: "2026-01-01T10:00:00.000Z" });
    expect(decidePackDraw([newer, older])).toEqual({ kind: "draw", packId: "p_old" });
  });

  it("skips packs with no credits left", () => {
    const empty = pack("p_empty", {
      creditsRemaining: 0,
      status: "exhausted",
      purchasedAt: "2026-01-01T10:00:00.000Z",
    });
    const fresh = pack("p_fresh", { purchasedAt: "2026-02-01T10:00:00.000Z" });
    expect(decidePackDraw([empty, fresh])).toEqual({ kind: "draw", packId: "p_fresh" });
  });

  it("skips refunded packs even when they still show credits", () => {
    const refunded = pack("p_ref", { status: "refunded" });
    expect(decidePackDraw([refunded])).toEqual({ kind: "exhausted" });
  });

  it("returns exhausted when every pack is spent or refunded", () => {
    const packs = [
      pack("p1", { creditsRemaining: 0, status: "exhausted" }),
      pack("p2", { status: "refunded", creditsRemaining: 0 }),
    ];
    expect(decidePackDraw(packs)).toEqual({ kind: "exhausted" });
  });
});
