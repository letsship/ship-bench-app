import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { gte } from "semver";

describe("semver dependency", () => {
  it("resolves to a version patched against GHSA-c2qf-rxjj-qqgw (CVE-2022-25883)", () => {
    const require = createRequire(import.meta.url);
    const semverPackageJsonPath = require.resolve("semver/package.json");
    const { version } = JSON.parse(readFileSync(semverPackageJsonPath, "utf8"));

    expect(gte(version, "7.5.2")).toBe(true);
  });
});
