import { describe, expect, it } from "vitest";
import { decideCreditDraw } from "./class-packages";

function pack(
  id: string,
  purchasedAt: string,
  over: Partial<{ status: string; creditsRemaining: number }> = {},
) {
  return { id, purchasedAt, status: "active", creditsRemaining: 5, ...over };
}

describe("decideCreditDraw", () => {
  it("is not applicable when the member never bought a pack", () => {
    expect(decideCreditDraw([])).toEqual({ applicable: false });
  });

  it("draws from a single active pack with credits", () => {
    expect(decideCreditDraw([pack("p1", "2026-01-01T00:00:00Z")])).toEqual({
      applicable: true,
      ok: true,
      packageId: "p1",
    });
  });

  it("draws from the oldest active pack when several have credits", () => {
    const packages = [pack("newer", "2026-02-01T00:00:00Z"), pack("older", "2026-01-01T00:00:00Z")];
    expect(decideCreditDraw(packages)).toEqual({ applicable: true, ok: true, packageId: "older" });
  });

  it("is exhausted when every pack has zero credits remaining", () => {
    const packages = [pack("p1", "2026-01-01T00:00:00Z", { creditsRemaining: 0 })];
    expect(decideCreditDraw(packages)).toEqual({ applicable: true, ok: false });
  });

  it("is exhausted when every pack is refunded", () => {
    const packages = [pack("p1", "2026-01-01T00:00:00Z", { status: "refunded" })];
    expect(decideCreditDraw(packages)).toEqual({ applicable: true, ok: false });
  });

  it("skips exhausted and refunded packs to draw from the remaining active one", () => {
    const packages = [
      pack("exhausted", "2026-01-01T00:00:00Z", { creditsRemaining: 0 }),
      pack("refunded", "2026-01-05T00:00:00Z", { status: "refunded" }),
      pack("active", "2026-01-10T00:00:00Z"),
    ];
    expect(decideCreditDraw(packages)).toEqual({ applicable: true, ok: true, packageId: "active" });
  });
});
