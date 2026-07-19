import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

describe("CVE-2022-25883: semver ReDoS vulnerability", () => {
  it("should not resolve semver versions in the vulnerable range [7.0.0, 7.5.2)", () => {
    const lockfilePath = resolve(__dirname, "../../../../pnpm-lock.yaml");
    const lockfileContent = readFileSync(lockfilePath, "utf-8");

    // Extract all semver@<version> entries from the lockfile
    const semverMatches = lockfileContent.match(/semver@[\d.]+/g) || [];
    const versions = semverMatches.map((match) => match.replace("semver@", ""));
    const uniqueVersions = [...new Set(versions)];

    // Check each version to ensure none are in the vulnerable range [7.0.0, 7.5.2)
    uniqueVersions.forEach((version) => {
      // Skip non-numeric versions
      if (!version.match(/^\d+\.\d+\.\d+/)) {
        return;
      }

      const parts = version.split(".").map((p) => parseInt(p, 10));
      const [major, minor, patch] = parts;

      // Vulnerable range: >=7.0.0 <7.5.2
      const isVulnerable =
        major === 7 && (minor > 0 || minor === 0) && (minor < 5 || (minor === 5 && patch < 2));

      expect(
        isVulnerable,
        `semver@${version} is in the vulnerable range [7.0.0, 7.5.2). Update to >=7.5.2.`,
      ).toBe(false);
    });

    // Additionally, verify that at least one semver 7.x is resolved and it's patched
    const semver7Versions = uniqueVersions.filter((v) => {
      const major = parseInt(v.split(".")[0], 10);
      return major === 7 && v.match(/^\d+\.\d+\.\d+/);
    });

    if (semver7Versions.length > 0) {
      const latestSemver7 = semver7Versions.sort().pop()!;
      const [, minor, patch] = latestSemver7.split(".").map((p) => parseInt(p, 10));
      const isPatched = minor > 5 || (minor === 5 && patch >= 2);
      expect(isPatched, `semver@${latestSemver7} in the 7.x line must be >= 7.5.2`).toBe(true);
    }
  });
});
