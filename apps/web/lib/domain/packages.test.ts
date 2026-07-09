import { describe, expect, it } from "vitest";
import type { ClassPackage } from "@/lib/db/types";
import { pickPackageToSpend } from "./packages";

const pack = (id: string, over: Partial<ClassPackage> = {}): ClassPackage => ({
  id,
  memberId: "m1",
  creditsTotal: 5,
  creditsRemaining: 5,
  priceCents: 5000,
  status: "active",
  purchasedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("pickPackageToSpend", () => {
  it("picks the oldest spendable pack", () => {
    const older = pack("p1", { purchasedAt: "2026-01-01T00:00:00.000Z" });
    const newer = pack("p2", { purchasedAt: "2026-02-01T00:00:00.000Z" });
    expect(pickPackageToSpend([newer, older])?.id).toBe("p1");
  });

  it("skips exhausted and refunded packs", () => {
    const exhausted = pack("p1", { creditsRemaining: 0 });
    const refunded = pack("p2", { status: "refunded", creditsRemaining: 3 });
    const spendable = pack("p3", { purchasedAt: "2026-03-01T00:00:00.000Z" });
    expect(pickPackageToSpend([exhausted, refunded, spendable])?.id).toBe("p3");
  });

  it("returns null when nothing is spendable", () => {
    const exhausted = pack("p1", { creditsRemaining: 0 });
    const refunded = pack("p2", { status: "refunded", creditsRemaining: 3 });
    expect(pickPackageToSpend([exhausted, refunded])).toBeNull();
  });

  it("returns null on an empty list", () => {
    expect(pickPackageToSpend([])).toBeNull();
  });
});
