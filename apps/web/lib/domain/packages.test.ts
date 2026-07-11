import { describe, expect, it } from "vitest";
import { computePackPrice, pickPackToSpend } from "./packages";

describe("computePackPrice", () => {
  it("prices a 5-credit pack at 5000 cents", () => {
    expect(computePackPrice(5)).toBe(5000);
  });

  it("prices a 10-credit pack at 10000 cents", () => {
    expect(computePackPrice(10)).toBe(10000);
  });
});

describe("pickPackToSpend", () => {
  it("returns null for an empty list", () => {
    expect(pickPackToSpend([])).toBeNull();
  });

  it("returns null when every pack is exhausted or refunded", () => {
    const packages = [
      { id: "p1", status: "active", creditsRemaining: 0, purchasedAt: "2026-01-01T00:00:00.000Z" },
      {
        id: "p2",
        status: "refunded",
        creditsRemaining: 0,
        purchasedAt: "2026-01-02T00:00:00.000Z",
      },
    ];
    expect(pickPackToSpend(packages)).toBeNull();
  });

  it("picks the oldest active pack with credits left, ignoring newer and unspendable ones", () => {
    const packages = [
      {
        id: "newer",
        status: "active",
        creditsRemaining: 3,
        purchasedAt: "2026-02-01T00:00:00.000Z",
      },
      {
        id: "older",
        status: "active",
        creditsRemaining: 1,
        purchasedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "refunded",
        status: "refunded",
        creditsRemaining: 5,
        purchasedAt: "2025-12-01T00:00:00.000Z",
      },
      {
        id: "exhausted",
        status: "active",
        creditsRemaining: 0,
        purchasedAt: "2025-11-01T00:00:00.000Z",
      },
    ];
    expect(pickPackToSpend(packages)).toBe("older");
  });
});
