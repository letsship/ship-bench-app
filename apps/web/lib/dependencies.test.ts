import { readFileSync } from "fs";
import { resolve } from "path";
import { test, expect } from "vitest";

test("semver should not be in vulnerable range CVE-2022-25883", () => {
  const lockfilePath = resolve(__dirname, "../../..", "pnpm-lock.yaml");
  const lockfileContent = readFileSync(lockfilePath, "utf-8");

  const semverVersions: string[] = [];
  const lines = lockfileContent.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^\s+semver@[\d.]+:/)) {
      const match = line.match(/semver@([\d.]+):/);
      if (match && match[1]) {
        semverVersions.push(match[1]);
      }
    }
  }

  expect(semverVersions).not.toContain("7.5.0");
  expect(semverVersions).not.toContain("7.5.1");
  expect(semverVersions).not.toContain("7.0.0");
  expect(semverVersions).not.toContain("7.1.0");
  expect(semverVersions).not.toContain("7.2.0");
  expect(semverVersions).not.toContain("7.3.0");
  expect(semverVersions).not.toContain("7.4.0");

  const vulnerableVersions = semverVersions.filter((v) => {
    const [major, minor] = v.split(".").map(Number);
    return major === 7 && minor < 5;
  });

  expect(vulnerableVersions).toEqual(
    [],
    `Found vulnerable semver versions in range >=7.0.0 <7.5.2: ${vulnerableVersions.join(", ")}`,
  );

  expect(
    semverVersions.length,
    "Expected to find at least one semver version in lockfile",
  ).toBeGreaterThan(0);
});
