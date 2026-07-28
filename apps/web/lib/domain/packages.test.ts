import { describe, expect, it } from "vitest";
import type { ClassPack } from "@/lib/db/types";
import { ownsAnyPack, packPriceCents, pickSpendablePack, voidRemaining } from "./packages";

const pack = (id: string, over: Partial<ClassPack> = {}): ClassPack => ({
  id,
  studioId: "s1",
  memberId: "m1",
  creditsTotal: 5,
  creditsRemaining: 5,
  priceCents: 5000,
  status: "active",
  purchasedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("packPriceCents", () => {
  it("prices packs at 1000 cents per credit (total price)", () => {
    expect(packPriceCents(5)).toBe(5000);
    expect(packPriceCents(10)).toBe(10000);
  });
});

describe("pickSpendablePack", () => {
  it("picks the oldest active pack with credits remaining", () => {
    const older = pack("a", { purchasedAt: "2026-01-01T00:00:00.000Z" });
    const newer = pack("b", { purchasedAt: "2026-02-01T00:00:00.000Z" });
    expect(pickSpendablePack([newer, older])?.id).toBe("a");
  });

  it("skips refunded and exhausted packs", () => {
    const refunded = pack("a", { status: "refunded" });
    const empty = pack("b", { creditsRemaining: 0 });
    const usable = pack("c", { purchasedAt: "2026-03-01T00:00:00.000Z" });
    expect(pickSpendablePack([refunded, empty, usable])?.id).toBe("c");
  });

  it("returns null when nothing is spendable", () => {
    expect(pickSpendablePack([])).toBeNull();
    expect(pickSpendablePack([pack("a", { creditsRemaining: 0 })])).toBeNull();
    expect(pickSpendablePack([pack("a", { status: "refunded" })])).toBeNull();
  });
});

describe("ownsAnyPack", () => {
  it("is true only when the member has at least one pack", () => {
    expect(ownsAnyPack([])).toBe(false);
    expect(ownsAnyPack([pack("a")])).toBe(true);
  });
});

describe("voidRemaining", () => {
  it("zeroes the remaining credits and marks the pack refunded", () => {
    expect(voidRemaining(pack("a"))).toEqual({ creditsRemaining: 0, status: "refunded" });
  });
});
