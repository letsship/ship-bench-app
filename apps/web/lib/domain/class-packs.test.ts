import { describe, expect, it } from "vitest";
import { type DrawablePack, pickPackToDraw } from "./class-packs";

const pack = (id: string, purchasedAt: string, creditsRemaining: number): DrawablePack => ({
  id,
  purchasedAt,
  creditsRemaining,
});

describe("pickPackToDraw", () => {
  it("picks the oldest eligible pack", () => {
    const packs = [
      pack("newer", "2026-03-10T00:00:00.000Z", 3),
      pack("older", "2026-03-01T00:00:00.000Z", 5),
    ];
    expect(pickPackToDraw(packs)).toBe("older");
  });

  it("skips exhausted and refunded (zero-credit) packs", () => {
    const packs = [
      pack("exhausted", "2026-03-01T00:00:00.000Z", 0),
      pack("has-credits", "2026-03-05T00:00:00.000Z", 2),
    ];
    expect(pickPackToDraw(packs)).toBe("has-credits");
  });

  it("returns null when no pack has credits left", () => {
    const packs = [
      pack("a", "2026-03-01T00:00:00.000Z", 0),
      pack("b", "2026-03-02T00:00:00.000Z", 0),
    ];
    expect(pickPackToDraw(packs)).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(pickPackToDraw([])).toBeNull();
  });
});
