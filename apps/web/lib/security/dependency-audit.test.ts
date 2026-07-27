import { describe, expect, it } from "vitest";
import { gte } from "semver";
import { version as semverVersion } from "semver/package.json";

// GHSA-c2qf-rxjj-qqgw / CVE-2022-25883: ReDoS in semver's range parser,
// fixed in 7.5.2. Locks the resolved version so it cannot regress into the
// vulnerable >=7.0.0 <7.5.2 range.
describe("dependency audit", () => {
  it("resolves semver at or above the patched version 7.5.2", () => {
    expect(gte(semverVersion, "7.5.2")).toBe(true);
  });
});
