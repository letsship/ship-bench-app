import { describe, expect, it } from "vitest";
import { applyDraw, isPackGated, packPriceCents, pickDrawablePack } from "./packs";

const pack = (id: string, purchasedAt: string, creditsRemaining: number, status = "active") => ({
  id,
  purchasedAt,
  creditsRemaining,
  status,
});

describe("class pack rules", () => {
  it("prices five and ten credits at 1000 cents each", () => {
    expect(packPriceCents(5)).toBe(5000);
    expect(packPriceCents(10)).toBe(10000);
  });

  it("picks the oldest drawable pack", () => {
    const selected = pickDrawablePack([
      pack("new", "2026-04-02T00:00:00.000Z", 5),
      pack("old", "2026-04-01T00:00:00.000Z", 1),
    ]);
    expect(selected?.id).toBe("old");
  });

  it("skips exhausted and refunded packs", () => {
    const selected = pickDrawablePack([
      pack("exhausted", "2026-04-01T00:00:00.000Z", 0, "exhausted"),
      pack("refunded", "2026-04-02T00:00:00.000Z", 4, "refunded"),
    ]);
    expect(selected).toBeNull();
  });

  it("marks a pack exhausted when its final credit is drawn", () => {
    expect(applyDraw(pack("p1", "2026-04-01T00:00:00.000Z", 1))).toMatchObject({
      creditsRemaining: 0,
      status: "exhausted",
    });
  });

  it("gates members who own any pack", () => {
    expect(isPackGated([])).toBe(false);
    expect(isPackGated([pack("p1", "2026-04-01T00:00:00.000Z", 0, "refunded")])).toBe(true);
  });
});
