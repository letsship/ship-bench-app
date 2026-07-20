import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("CVE-2022-25883: semver ReDoS vulnerability", () => {
  it("should not resolve semver versions in the vulnerable range [7.0.0, 7.5.2)", () => {
    // CVE-2022-25883 / GHSA-c2qf-rxjj-qqgw: Regular Expression Denial of Service in semver
    // Affected versions: >= 7.0.0 < 7.5.2
    // Patched in: 7.5.2

    const lockfilePath = path.resolve(__dirname, "../../../..", "pnpm-lock.yaml");
    const lockfileContent = fs.readFileSync(lockfilePath, "utf-8");

    // Extract all semver@<version> entries from the lockfile
    const semverMatches = lockfileContent.match(/semver@[\d.]+/g) || [];
    const versions = [...new Set(semverMatches.map((m) => m.replace("semver@", "")))].sort();

    const isInVulnerableRange = (version: string): boolean => {
      // Parse major.minor.patch
      const [major, minor, patch] = version.split(".").map(Number);

      // Check if version is >= 7.0.0 and < 7.5.2
      if (major !== 7) return false;
      if (major > 7) return false;

      // major === 7
      if (minor > 5) return false;
      if (minor < 5) return true;

      // major === 7 && minor === 5
      if (patch < 2) return true; // 7.5.0, 7.5.1 are vulnerable
      return false; // 7.5.2+ are patched
    };

    const vulnerableVersions = versions.filter(isInVulnerableRange);
    expect(
      vulnerableVersions,
      `No semver versions should be in the vulnerable range [7.0.0, 7.5.2), but found: ${vulnerableVersions.join(", ")}`,
    ).toEqual([]);
  });
});
