import { describe, expect, it } from "vitest";
import { type PackCredit, pickPackToSpendFrom } from "./class-packages";

function pack(id: string, over: Partial<PackCredit> = {}): PackCredit {
  return {
    id,
    status: "active",
    creditsRemaining: 5,
    purchasedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("pickPackToSpendFrom", () => {
  it("picks the oldest active pack with a credit remaining", () => {
    const id = pickPackToSpendFrom([
      pack("newer", { purchasedAt: "2026-02-01T00:00:00Z" }),
      pack("older", { purchasedAt: "2026-01-01T00:00:00Z" }),
    ]);
    expect(id).toBe("older");
  });

  it("skips a refunded pack", () => {
    const id = pickPackToSpendFrom([pack("refunded", { status: "refunded" }), pack("active")]);
    expect(id).toBe("active");
  });

  it("skips an exhausted pack", () => {
    const id = pickPackToSpendFrom([pack("empty", { creditsRemaining: 0 }), pack("full")]);
    expect(id).toBe("full");
  });

  it("returns null when nothing is usable", () => {
    const id = pickPackToSpendFrom([
      pack("refunded", { status: "refunded" }),
      pack("empty", { creditsRemaining: 0 }),
    ]);
    expect(id).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(pickPackToSpendFrom([])).toBeNull();
  });
});
