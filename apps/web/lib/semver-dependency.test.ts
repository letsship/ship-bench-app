import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { minVersion, satisfies } from "semver";

// Hermetic guard for CVE-2022-25883 (GHSA-c2qf-rxjj-qqgw): the ReDoS in the
// semver range parser was patched in 7.5.2. This test fails loudly if the
// dependency is ever re-pinned into the vulnerable range (>=7.0.0 <7.5.2).
const PATCHED_FLOOR = "7.5.2";

function readDeclaredRange(): string {
  const packageJsonUrl = new URL("../package.json", import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as {
    dependencies: Record<string, string>;
  };
  return packageJson.dependencies.semver;
}

function readInstalledVersion(): string {
  const require = createRequire(import.meta.url);
  const packageJsonPath = require.resolve("semver/package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version: string;
  };
  return packageJson.version;
}

describe("semver dependency (CVE-2022-25883)", () => {
  it("declares a range whose minimum is at least the patched 7.5.2", () => {
    const range = readDeclaredRange();
    expect(range).not.toBe("7.5.1");
    const minimum = minVersion(range);
    expect(minimum).not.toBeNull();
    expect(satisfies(minimum!, `>=${PATCHED_FLOOR}`)).toBe(true);
  });

  it("resolves to an installed version at or above the patched 7.5.2", () => {
    const installed = readInstalledVersion();
    expect(satisfies(installed, `>=${PATCHED_FLOOR}`)).toBe(true);
  });
});
