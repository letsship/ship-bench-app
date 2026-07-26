import { describe, expect, it } from "vitest";
import { isDrawable, ownsAnyPack, packPriceCents, pickPackToDraw } from "./packages";

describe("packPriceCents", () => {
  it("is the total price, not the per-credit rate", () => {
    expect(packPriceCents(5)).toBe(5000);
    expect(packPriceCents(10)).toBe(10000);
  });
});

describe("isDrawable", () => {
  it("is true only for an active pack with credits left", () => {
    expect(isDrawable({ id: "p1", status: "active", creditsRemaining: 1, purchasedAt: "" })).toBe(
      true,
    );
    expect(isDrawable({ id: "p1", status: "active", creditsRemaining: 0, purchasedAt: "" })).toBe(
      false,
    );
    expect(isDrawable({ id: "p1", status: "refunded", creditsRemaining: 3, purchasedAt: "" })).toBe(
      false,
    );
  });
});

describe("pickPackToDraw", () => {
  it("picks the oldest active pack with credits remaining", () => {
    const picked = pickPackToDraw([
      { id: "newer", status: "active", creditsRemaining: 3, purchasedAt: "2026-02-01T00:00:00Z" },
      { id: "older", status: "active", creditsRemaining: 1, purchasedAt: "2026-01-01T00:00:00Z" },
    ]);
    expect(picked).toBe("older");
  });

  it("skips exhausted and refunded packs", () => {
    const picked = pickPackToDraw([
      {
        id: "exhausted",
        status: "active",
        creditsRemaining: 0,
        purchasedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "refunded",
        status: "refunded",
        creditsRemaining: 5,
        purchasedAt: "2026-01-02T00:00:00Z",
      },
      { id: "usable", status: "active", creditsRemaining: 2, purchasedAt: "2026-01-03T00:00:00Z" },
    ]);
    expect(picked).toBe("usable");
  });

  it("returns null when nothing is drawable", () => {
    expect(
      pickPackToDraw([
        {
          id: "exhausted",
          status: "active",
          creditsRemaining: 0,
          purchasedAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "refunded",
          status: "refunded",
          creditsRemaining: 5,
          purchasedAt: "2026-01-02T00:00:00Z",
        },
      ]),
    ).toBeNull();
    expect(pickPackToDraw([])).toBeNull();
  });
});

describe("ownsAnyPack", () => {
  it("is true when the member has at least one pack, false otherwise", () => {
    expect(ownsAnyPack([{ id: "p1" }])).toBe(true);
    expect(ownsAnyPack([])).toBe(false);
  });
});
