import { describe, expect, it } from "vitest";
import { type PackLike, resolvePackDraw } from "./pack-rules";

function pack(id: string, over: Partial<PackLike> = {}): PackLike {
  return {
    id,
    status: "active",
    creditsRemaining: 5,
    purchasedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("resolvePackDraw", () => {
  it("returns none when the member owns no packs", () => {
    expect(resolvePackDraw([])).toEqual({ kind: "none" });
  });

  it("draws the single active pack with credits", () => {
    expect(resolvePackDraw([pack("p1")])).toEqual({ kind: "draw", packId: "p1" });
  });

  it("draws the oldest pack by purchasedAt when multiple are active", () => {
    const packs = [
      pack("p2", { purchasedAt: "2026-02-01T00:00:00Z" }),
      pack("p1", { purchasedAt: "2026-01-01T00:00:00Z" }),
    ];
    expect(resolvePackDraw(packs)).toEqual({ kind: "draw", packId: "p1" });
  });

  it("returns exhausted when every pack has zero credits remaining", () => {
    const packs = [pack("p1", { creditsRemaining: 0 }), pack("p2", { creditsRemaining: 0 })];
    expect(resolvePackDraw(packs)).toEqual({ kind: "exhausted" });
  });

  it("returns exhausted when every pack is refunded", () => {
    const packs = [pack("p1", { status: "refunded" })];
    expect(resolvePackDraw(packs)).toEqual({ kind: "exhausted" });
  });

  it("never selects a refunded pack even with lingering credits", () => {
    const packs = [
      pack("p1", { status: "refunded", creditsRemaining: 3, purchasedAt: "2026-01-01T00:00:00Z" }),
      pack("p2", { purchasedAt: "2026-02-01T00:00:00Z" }),
    ];
    expect(resolvePackDraw(packs)).toEqual({ kind: "draw", packId: "p2" });
  });
});
