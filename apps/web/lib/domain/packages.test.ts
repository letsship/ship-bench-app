import { describe, expect, it } from "vitest";
import { pickSpendablePack, type SpendablePack } from "./packages";

const pack = (id: string, over: Partial<SpendablePack> = {}): SpendablePack => ({
  id,
  status: "active",
  creditsRemaining: 5,
  purchasedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("pickSpendablePack", () => {
  it("picks the oldest active pack among several", () => {
    const packs = [
      pack("newer", { purchasedAt: "2026-03-01T00:00:00.000Z" }),
      pack("oldest", { purchasedAt: "2026-01-01T00:00:00.000Z" }),
      pack("middle", { purchasedAt: "2026-02-01T00:00:00.000Z" }),
    ];
    expect(pickSpendablePack(packs)?.id).toBe("oldest");
  });

  it("skips exhausted packs", () => {
    const packs = [
      pack("exhausted", { purchasedAt: "2026-01-01T00:00:00.000Z", creditsRemaining: 0 }),
      pack("has-credits", { purchasedAt: "2026-02-01T00:00:00.000Z", creditsRemaining: 3 }),
    ];
    expect(pickSpendablePack(packs)?.id).toBe("has-credits");
  });

  it("skips refunded packs", () => {
    const packs = [
      pack("refunded", {
        purchasedAt: "2026-01-01T00:00:00.000Z",
        status: "refunded",
        creditsRemaining: 5,
      }),
      pack("active", { purchasedAt: "2026-02-01T00:00:00.000Z" }),
    ];
    expect(pickSpendablePack(packs)?.id).toBe("active");
  });

  it("returns null when nothing is spendable", () => {
    const packs = [
      pack("exhausted", { creditsRemaining: 0 }),
      pack("refunded", { status: "refunded" }),
    ];
    expect(pickSpendablePack(packs)).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(pickSpendablePack([])).toBeNull();
  });
});
