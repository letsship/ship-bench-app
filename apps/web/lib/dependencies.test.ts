import semverPackage from "semver/package.json";
import { satisfies } from "semver";
import { describe, expect, it } from "vitest";

describe("runtime dependencies", () => {
  it("resolves a patched semver release", () => {
    expect(satisfies(semverPackage.version, ">=7.5.2")).toBe(true);
  });
});
