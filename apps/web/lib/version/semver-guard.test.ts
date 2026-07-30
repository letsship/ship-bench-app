import { describe, expect, it } from "vitest";
import { gte, satisfies } from "semver";
import { version as installedSemverVersion } from "semver/package.json";

// CVE-2022-25883 / GHSA-c2qf-rxjj-qqgw: the semver range parser can be driven
// into super-linear backtracking (ReDoS) by a crafted version or range string.
// `apps/web` depends on semver directly to gate the minimum supported client
// version (see ../version.ts), so a downgrade back into the affected range
// would reintroduce the vulnerability. These assertions fail CI if that happens.
const PATCHED_VERSION = "7.5.2";
const VULNERABLE_RANGE = ">=7.0.0 <7.5.2";

describe("semver dependency (CVE-2022-25883)", () => {
  it("resolves to the patched release or newer", () => {
    expect(gte(installedSemverVersion, PATCHED_VERSION)).toBe(true);
  });

  it("does not resolve into the vulnerable range", () => {
    expect(satisfies(installedSemverVersion, VULNERABLE_RANGE)).toBe(false);
  });
});
