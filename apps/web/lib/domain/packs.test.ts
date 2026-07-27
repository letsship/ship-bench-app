import { describe, expect, it } from "vitest";
import {
  creditsToPriceCents,
  type DrawablePack,
  pickDrawablePack,
  voidPackForRefund,
} from "./packs";

describe("creditsToPriceCents", () => {
  it("prices a 5-credit pack at 5000 cents total", () => {
    expect(creditsToPriceCents(5)).toBe(5000);
  });

  it("prices a 10-credit pack at 10000 cents total", () => {
    expect(creditsToPriceCents(10)).toBe(10000);
  });
});

const pack = (id: string, over: Partial<DrawablePack> = {}): DrawablePack => ({
  id,
  status: "active",
  creditsRemaining: 5,
  purchasedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("pickDrawablePack", () => {
  it("returns the oldest active pack with credits", () => {
    const older = pack("older", { purchasedAt: "2026-01-01T00:00:00.000Z" });
    const newer = pack("newer", { purchasedAt: "2026-02-01T00:00:00.000Z" });
    expect(pickDrawablePack([newer, older])?.id).toBe("older");
  });

  it("skips exhausted packs", () => {
    const exhausted = pack("exhausted", { creditsRemaining: 0 });
    const drawable = pack("drawable", { purchasedAt: "2026-02-01T00:00:00.000Z" });
    expect(pickDrawablePack([exhausted, drawable])?.id).toBe("drawable");
  });

  it("skips refunded packs", () => {
    const refunded = pack("refunded", { status: "refunded" });
    const drawable = pack("drawable", { purchasedAt: "2026-02-01T00:00:00.000Z" });
    expect(pickDrawablePack([refunded, drawable])?.id).toBe("drawable");
  });

  it("returns null when no pack is drawable", () => {
    const exhausted = pack("exhausted", { creditsRemaining: 0 });
    const refunded = pack("refunded", { status: "refunded" });
    expect(pickDrawablePack([exhausted, refunded])).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(pickDrawablePack([])).toBeNull();
  });
});

describe("voidPackForRefund", () => {
  it("zeroes credits and marks the pack refunded", () => {
    expect(voidPackForRefund()).toEqual({ creditsRemaining: 0, status: "refunded" });
  });
});
