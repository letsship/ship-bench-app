import { describe, expect, it } from "vitest";
import * as semver from "semver";
import packageJson from "semver/package.json";

describe("semver version check", () => {
  it("uses semver >= 7.5.2 (patched for CVE-2022-25883)", () => {
    expect(semver.gte(packageJson.version, "7.5.2")).toBe(true);
  });
});
