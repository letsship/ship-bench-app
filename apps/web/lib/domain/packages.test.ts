import { describe, expect, it } from "vitest";
import type { Package } from "@/lib/db/types";
import { hasEverPurchased, packPriceCents, pickPackToDraw } from "./packages";

function newPackage(overrides?: Partial<Package>): Package {
  return {
    id: "pkg1",
    studioId: "studio1",
    memberId: "member1",
    creditsTotal: 5,
    creditsRemaining: 5,
    priceCents: 5000,
    status: "active",
    purchasedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("packPriceCents", () => {
  it("computes total price as credits × 1000", () => {
    expect(packPriceCents(5)).toBe(5000);
    expect(packPriceCents(10)).toBe(10000);
  });
});

describe("pickPackToDraw", () => {
  it("returns null when no active packages with credits remain", () => {
    expect(pickPackToDraw([])).toBeNull();
    expect(pickPackToDraw([newPackage({ status: "refunded" })])).toBeNull();
    expect(pickPackToDraw([newPackage({ creditsRemaining: 0 })])).toBeNull();
  });

  it("picks the oldest active package with credits remaining", () => {
    const older = newPackage({ id: "older", purchasedAt: "2026-01-01T00:00:00Z" });
    const newer = newPackage({ id: "newer", purchasedAt: "2026-02-01T00:00:00Z" });
    const pick = pickPackToDraw([newer, older]);
    expect(pick?.id).toBe("older");
  });

  it("skips exhausted and refunded packs", () => {
    const exhausted = newPackage({
      id: "exhausted",
      creditsRemaining: 0,
      purchasedAt: "2026-01-01T00:00:00Z",
    });
    const refunded = newPackage({
      id: "refunded",
      status: "refunded",
      purchasedAt: "2026-01-02T00:00:00Z",
    });
    const active = newPackage({ id: "active", purchasedAt: "2026-01-03T00:00:00Z" });
    const pick = pickPackToDraw([active, exhausted, refunded]);
    expect(pick?.id).toBe("active");
  });
});

describe("hasEverPurchased", () => {
  it("returns true when any package exists", () => {
    expect(hasEverPurchased([newPackage()])).toBe(true);
  });

  it("returns false when no packages exist", () => {
    expect(hasEverPurchased([])).toBe(false);
  });
});
