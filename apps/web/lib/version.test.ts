import { describe, expect, it } from "vitest";
import { isSupportedClientVersion } from "./version";

describe("isSupportedClientVersion", () => {
  it("accepts a version at or above the minimum", () => {
    expect(isSupportedClientVersion("1.4.0")).toBe(true);
    expect(isSupportedClientVersion("2.0.1")).toBe(true);
  });

  it("rejects an older or malformed version", () => {
    expect(isSupportedClientVersion("1.3.9")).toBe(false);
    expect(isSupportedClientVersion("not-a-version")).toBe(false);
  });

  // Regression guard for CVE-2022-25883 (GHSA-c2qf-rxjj-qqgw): a crafted
  // version string must not drive the range parser into super-linear
  // backtracking. Patched semver (>= 7.5.2) rejects this immediately.
  it("rejects a crafted long version string without hanging", () => {
    const crafted = `1.2.3 ${" ".repeat(10_000)}1.2.3`;
    const start = performance.now();
    const result = isSupportedClientVersion(crafted);
    const elapsed = performance.now() - start;
    expect(result).toBe(false);
    expect(elapsed).toBeLessThan(1000);
  });
});
