import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// GHSA-c2qf-rxjj-qqgw (CVE-2022-25883): semver >=7.0.0 <7.5.2 has a ReDoS in
// its range parser. The pnpm override in pnpm-workspace.yaml pins the 7.x line
// to a patched release; this test fails if a vulnerable resolution ever
// re-enters the lockfile.

const LOCKFILE_URL = new URL("../../../../pnpm-lock.yaml", import.meta.url);

type Version = { major: number; minor: number; patch: number };

function parseVersion(raw: string): Version {
  const [major, minor, patch] = raw.split(".").map(Number);
  return { major, minor, patch };
}

function collectSemverResolutions(lockfile: string): string[] {
  // Matches `semver@X.Y.Z` keys while excluding scoped lookalikes such as
  // `@types/semver@X.Y.Z`.
  const matches = lockfile.matchAll(/(?<![\w/@.-])semver@(\d+\.\d+\.\d+)/g);
  return [...new Set([...matches].map((match) => match[1]))];
}

function isVulnerable({ major, minor, patch }: Version): boolean {
  return major === 7 && (minor < 5 || (minor === 5 && patch < 2));
}

describe("semver dependency resolution", () => {
  const resolutions = collectSemverResolutions(readFileSync(LOCKFILE_URL, "utf8"));

  it("finds semver resolutions in the lockfile", () => {
    expect(resolutions.length).toBeGreaterThan(0);
  });

  it("resolves no semver version in the vulnerable range >=7.0.0 <7.5.2", () => {
    const vulnerable = resolutions.filter((version) => isVulnerable(parseVersion(version)));
    expect(vulnerable).toEqual([]);
  });
});
