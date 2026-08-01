import { describe, expect, it } from "vitest";
import {
  PACK_CREDIT_OPTIONS,
  type PackShape,
  isDrawable,
  packPriceCents,
  resolvePackDraw,
} from "./packs";

const pack = (id: string, over: Partial<PackShape> = {}): PackShape => ({
  id,
  status: "active",
  creditsRemaining: 5,
  purchasedAt: "2026-06-01T09:00:00.000Z",
  ...over,
});

describe("packPriceCents", () => {
  it("prices a pack at 1000 cents per credit (total, not per-credit)", () => {
    expect(packPriceCents(5)).toBe(5000);
    expect(packPriceCents(10)).toBe(10000);
  });

  it("covers every offered pack size", () => {
    expect(PACK_CREDIT_OPTIONS).toEqual([5, 10]);
  });
});

describe("isDrawable", () => {
  it("allows an active pack with credits left", () => {
    expect(isDrawable(pack("p1"))).toBe(true);
  });

  it("blocks an active pack with zero credits", () => {
    expect(isDrawable(pack("p1", { creditsRemaining: 0 }))).toBe(false);
  });

  it("blocks a refunded pack even if credits remain", () => {
    expect(isDrawable(pack("p1", { status: "refunded", creditsRemaining: 3 }))).toBe(false);
  });
});

describe("resolvePackDraw", () => {
  it("returns no_pack for a member who never bought one", () => {
    expect(resolvePackDraw([])).toEqual({ kind: "no_pack" });
  });

  it("draws from the oldest active pack with credits", () => {
    const packs = [
      pack("newer", { purchasedAt: "2026-06-20T09:00:00.000Z" }),
      pack("older", { purchasedAt: "2026-05-01T09:00:00.000Z" }),
    ];
    expect(resolvePackDraw(packs)).toEqual({ kind: "draw", packId: "older" });
  });

  it("skips exhausted and refunded packs when picking the oldest", () => {
    const packs = [
      pack("spent", { purchasedAt: "2026-04-01T09:00:00.000Z", creditsRemaining: 0 }),
      pack("refunded", { purchasedAt: "2026-04-15T09:00:00.000Z", status: "refunded" }),
      pack("usable", { purchasedAt: "2026-06-01T09:00:00.000Z" }),
    ];
    expect(resolvePackDraw(packs)).toEqual({ kind: "draw", packId: "usable" });
  });

  it("reports exhausted when every owned pack is used up or refunded", () => {
    const packs = [
      pack("spent", { creditsRemaining: 0 }),
      pack("refunded", { status: "refunded", creditsRemaining: 0 }),
    ];
    expect(resolvePackDraw(packs)).toEqual({ kind: "exhausted" });
  });
});
