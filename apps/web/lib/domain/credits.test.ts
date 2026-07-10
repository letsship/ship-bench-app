import { describe, expect, it } from "vitest";
import type { ClassPackage } from "../db/types";
import { selectPackageToSpend } from "./credits";

function pack(id: string, over: Partial<ClassPackage> = {}): ClassPackage {
  return {
    id,
    studioId: "s1",
    memberId: "m1",
    creditsTotal: 10,
    creditsRemaining: 10,
    priceCents: 10000,
    status: "active",
    purchasedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("selectPackageToSpend", () => {
  it("picks the oldest pack with credits remaining when several are active", () => {
    const packages = [
      pack("newer", { purchasedAt: "2026-02-01T00:00:00Z" }),
      pack("older", { purchasedAt: "2026-01-01T00:00:00Z" }),
    ];
    expect(selectPackageToSpend(packages)?.id).toBe("older");
  });

  it("skips refunded and exhausted packs", () => {
    const packages = [
      pack("refunded", {
        purchasedAt: "2026-01-01T00:00:00Z",
        status: "refunded",
        creditsRemaining: 0,
      }),
      pack("exhausted", { purchasedAt: "2026-01-02T00:00:00Z", creditsRemaining: 0 }),
      pack("eligible", { purchasedAt: "2026-01-03T00:00:00Z", creditsRemaining: 1 }),
    ];
    expect(selectPackageToSpend(packages)?.id).toBe("eligible");
  });

  it("returns null when no pack has credits left", () => {
    const packages = [
      pack("refunded", { status: "refunded", creditsRemaining: 0 }),
      pack("exhausted", { creditsRemaining: 0 }),
    ];
    expect(selectPackageToSpend(packages)).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(selectPackageToSpend([])).toBeNull();
  });
});
