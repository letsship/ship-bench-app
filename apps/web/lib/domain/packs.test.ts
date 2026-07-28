import { describe, expect, it } from "vitest";
import type { Pack } from "@/lib/db/types";
import {
  isDrawable,
  memberOwnsAnyPack,
  packPriceCents,
  PACK_PRICE_PER_CREDIT_CENTS,
  pickDrawablePack,
} from "./packs";

const basePack = (over: Partial<Pack> = {}): Pack => ({
  id: "p1",
  studioId: "s1",
  memberId: "m1",
  creditsTotal: 10,
  creditsRemaining: 10,
  priceCents: 10000,
  status: "active",
  purchasedAt: "2026-07-01T12:00:00.000Z",
  ...over,
});

describe("packPriceCents", () => {
  it("prices a 5-credit pack at 5000", () => {
    expect(packPriceCents(5)).toBe(5000);
  });

  it("prices a 10-credit pack at 10000", () => {
    expect(packPriceCents(10)).toBe(10000);
  });

  it("uses 1000 cents per credit", () => {
    expect(PACK_PRICE_PER_CREDIT_CENTS).toBe(1000);
  });
});

describe("isDrawable", () => {
  it("returns true for an active pack with credits remaining", () => {
    expect(isDrawable(basePack())).toBe(true);
  });

  it("returns false for a refunded pack", () => {
    expect(isDrawable(basePack({ status: "refunded" }))).toBe(false);
  });

  it("returns false for an exhausted pack (0 remaining)", () => {
    expect(isDrawable(basePack({ creditsRemaining: 0 }))).toBe(false);
  });
});

describe("pickDrawablePack", () => {
  it("returns the oldest drawable pack", () => {
    const older = basePack({ id: "p1", purchasedAt: "2026-07-01T12:00:00.000Z" });
    const newer = basePack({ id: "p2", purchasedAt: "2026-08-01T12:00:00.000Z" });
    expect(pickDrawablePack([newer, older])?.id).toBe("p1");
  });

  it("skips refunded packs and picks the oldest drawable", () => {
    const refunded = basePack({ id: "p1", status: "refunded", purchasedAt: "2026-07-01T12:00:00.000Z" });
    const active = basePack({ id: "p2", purchasedAt: "2026-08-01T12:00:00.000Z" });
    expect(pickDrawablePack([refunded, active])?.id).toBe("p2");
  });

  it("skips exhausted packs and picks the oldest drawable", () => {
    const exhausted = basePack({ id: "p1", creditsRemaining: 0, purchasedAt: "2026-07-01T12:00:00.000Z" });
    const active = basePack({ id: "p2", purchasedAt: "2026-08-01T12:00:00.000Z" });
    expect(pickDrawablePack([exhausted, active])?.id).toBe("p2");
  });

  it("returns null when no packs are drawable", () => {
    const refunded = basePack({ id: "p1", status: "refunded" });
    const exhausted = basePack({ id: "p2", creditsRemaining: 0 });
    expect(pickDrawablePack([refunded, exhausted])).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(pickDrawablePack([])).toBeNull();
  });
});

describe("memberOwnsAnyPack", () => {
  it("returns true when the member has at least one pack", () => {
    expect(memberOwnsAnyPack([basePack()])).toBe(true);
  });

  it("returns false when the member has no packs", () => {
    expect(memberOwnsAnyPack([])).toBe(false);
  });
});