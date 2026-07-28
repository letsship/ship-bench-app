import { describe, expect, it } from "vitest";
import semver from "semver";
import semverPackage from "semver/package.json";

// Guards against reintroducing a semver affected by GHSA-c2qf-rxjj-qqgw
// (CVE-2022-25883, ReDoS in the range parser, fixed in 7.5.2).
describe("semver dependency", () => {
  it("resolves to a version patched against CVE-2022-25883", () => {
    expect(semver.gte(semverPackage.version, "7.5.2")).toBe(true);
  });
});
