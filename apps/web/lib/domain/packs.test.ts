import { describe, expect, it } from "vitest";
import { isDrawable, ownsAnyPack, pickDrawablePack, priceForCredits } from "./packs";

const pack = (id: string, purchasedAt: string, over: Record<string, unknown> = {}) => ({
  id,
  status: "active",
  creditsRemaining: 2,
  purchasedAt,
  ...over,
});

describe("class pack rules", () => {
  it("prices packs at 1000 cents per credit", () => {
    expect(priceForCredits(5)).toBe(5000);
    expect(priceForCredits(10)).toBe(10000);
  });

  it("only active packs with credits are drawable", () => {
    expect(isDrawable(pack("active", "2026-01-01"))).toBe(true);
    expect(isDrawable(pack("refunded", "2026-01-01", { status: "refunded" }))).toBe(false);
    expect(isDrawable(pack("empty", "2026-01-01", { creditsRemaining: 0 }))).toBe(false);
  });

  it("picks the oldest drawable pack", () => {
    const oldest = pack("oldest", "2026-01-01");
    expect(
      pickDrawablePack([
        pack("refunded", "2025-01-01", { status: "refunded" }),
        pack("empty", "2025-02-01", { creditsRemaining: 0 }),
        pack("newest", "2026-02-01"),
        oldest,
      ])?.id,
    ).toBe("oldest");
  });

  it("reports whether a member has ever owned a pack", () => {
    expect(ownsAnyPack([])).toBe(false);
    expect(ownsAnyPack([pack("pack", "2026-01-01", { creditsRemaining: 0 })])).toBe(true);
  });
});
