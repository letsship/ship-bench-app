import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";

describe("CVE-2022-25883: semver ReDoS vulnerability", () => {
  it("should not resolve semver in vulnerable range >=7.0.0 <7.5.2", () => {
    const lockfilePath = resolve(__dirname, "../../../../pnpm-lock.yaml");
    const lockfileContent = readFileSync(lockfilePath, "utf-8");

    // Extract all semver@X.Y.Z versions from lockfile
    const semverVersions = new Set<string>();
    const versionRegex = /semver@(\d+\.\d+\.\d+):/g;
    let match;

    while ((match = versionRegex.exec(lockfileContent)) !== null) {
      semverVersions.add(match[1]);
    }

    // Helper to parse version string into comparable tuple
    const parseVersion = (v: string): [number, number, number] => {
      const parts = v.split(".");
      return [parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2], 10)];
    };

    // Helper to check if version is in vulnerable range >=7.0.0 <7.5.2
    const isVulnerable = (v: string): boolean => {
      const [major, minor, patch] = parseVersion(v);
      if (major !== 7) return false;
      if (minor > 5) return false;
      if (minor < 5) return true;
      // minor === 5, check patch
      return patch < 2;
    };

    const vulnerableVersions = Array.from(semverVersions).filter(isVulnerable);

    expect(
      vulnerableVersions,
      `Found semver versions in vulnerable range >=7.0.0 <7.5.2: ${vulnerableVersions.join(", ")}`,
    ).toEqual([]);
  });
});
