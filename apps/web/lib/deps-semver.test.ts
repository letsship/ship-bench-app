import { describe, expect, it } from "vitest";
import * as semver from "semver";

describe("semver dependency", () => {
  it("uses a version patched for CVE-2022-25883", async () => {
    // Load the semver package.json to verify the version meets the minimum patched requirement
    const pkg = await import("semver/package.json", {
      assert: { type: "json" },
    });
    const version = pkg.default.version;
    expect(semver.satisfies(version, ">=7.5.2")).toBe(true);
  });

  it("handles long crafted range strings without catastrophic backtracking", () => {
    const start = Date.now();
    // Crafted input that would trigger ReDoS in versions < 7.5.2
    const crafted =
      "1.0.0 || >=1.0.0-0 <1.0.0-0 || >=1.0.0-0 <1.0.0-0 || >=1.0.0-0 <1.0.0-0 || >=1.0.0-0 <1.0.0-0 || >=1.0.0-0 <1.0.0-0 || >=1.0.0-0 <1.0.0-0 || >=1.0.0-0 <1.0.0-0 || >=1.0.0-0 <1.0.0-0 || >=1.0.0-0 <1.0.0-0";
    expect(() => semver.validRange(crafted)).not.toThrow();
    const elapsed = Date.now() - start;
    // Patched versions should parse in < 100ms; vulnerable versions timeout
    expect(elapsed).toBeLessThan(100);
  });
});
