import { describe, expect, it } from "vitest";
import {
  ALLOWED_PACK_CREDITS,
  hasDrawableCredit,
  memberOwnsPack,
  packPriceCents,
  pickPackToDraw,
} from "./packs";

const pack = (id: string, over: Partial<Parameters<typeof pickPackToDraw>[0][number]> = {}) => ({
  id,
  status: "active",
  creditsRemaining: 5,
  purchasedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("pack pricing", () => {
  it("prices a 5-credit pack at 5000 cents", () => {
    expect(packPriceCents(5)).toBe(5000);
  });

  it("prices a 10-credit pack at 10000 cents", () => {
    expect(packPriceCents(10)).toBe(10000);
  });

  it("offers exactly the 5- and 10-credit sizes", () => {
    expect(ALLOWED_PACK_CREDITS).toEqual([5, 10]);
  });
});

describe("memberOwnsPack", () => {
  it("is false for a member who never bought a pack", () => {
    expect(memberOwnsPack([])).toBe(false);
  });

  it("is true even when every pack is exhausted or refunded", () => {
    expect(memberOwnsPack([pack("p1", { creditsRemaining: 0 })])).toBe(true);
    expect(memberOwnsPack([pack("p1", { status: "refunded" })])).toBe(true);
  });
});

describe("pickPackToDraw", () => {
  it("picks the oldest active pack with credits", () => {
    const older = pack("p1", { purchasedAt: "2026-01-01T00:00:00.000Z" });
    const newer = pack("p2", { purchasedAt: "2026-02-01T00:00:00.000Z" });
    expect(pickPackToDraw([newer, older])?.id).toBe("p1");
  });

  it("skips exhausted packs", () => {
    const exhausted = pack("p1", { creditsRemaining: 0 });
    const fresh = pack("p2", { purchasedAt: "2026-02-01T00:00:00.000Z" });
    expect(pickPackToDraw([exhausted, fresh])?.id).toBe("p2");
  });

  it("skips refunded packs", () => {
    const refunded = pack("p1", { status: "refunded" });
    const fresh = pack("p2", { purchasedAt: "2026-02-01T00:00:00.000Z" });
    expect(pickPackToDraw([refunded, fresh])?.id).toBe("p2");
  });

  it("returns null when nothing is drawable", () => {
    expect(pickPackToDraw([])).toBeNull();
    expect(pickPackToDraw([pack("p1", { creditsRemaining: 0 })])).toBeNull();
    expect(pickPackToDraw([pack("p1", { status: "refunded" })])).toBeNull();
  });
});

describe("hasDrawableCredit", () => {
  it("is true when an active pack has credits", () => {
    expect(hasDrawableCredit([pack("p1")])).toBe(true);
  });

  it("is false when every pack is empty or refunded", () => {
    expect(hasDrawableCredit([])).toBe(false);
    expect(
      hasDrawableCredit([pack("p1", { creditsRemaining: 0 }), pack("p2", { status: "refunded" })]),
    ).toBe(false);
  });
});
