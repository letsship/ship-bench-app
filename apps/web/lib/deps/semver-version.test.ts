import { describe, expect, it } from "vitest";
import pkg from "semver/package.json";

describe("semver dependency", () => {
  it("resolves to a patched version (>= 7.5.2)", () => {
    const version = pkg.version;
    const [major, minor, patch] = version.split(".").map(Number);

    // Verify version is >= 7.5.2
    if (major > 7) {
      expect(major).toBeGreaterThan(7);
    } else if (major === 7) {
      if (minor > 5) {
        expect(minor).toBeGreaterThan(5);
      } else if (minor === 5) {
        expect(patch).toBeGreaterThanOrEqual(2);
      } else {
        throw new Error(`semver ${version} is in the vulnerable range [7.0.0, 7.5.2)`);
      }
    } else {
      throw new Error(`semver ${version} is in the vulnerable range [7.0.0, 7.5.2)`);
    }
  });
});
