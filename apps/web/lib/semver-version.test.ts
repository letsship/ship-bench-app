import { gte } from "semver";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- importing the resolved package's package.json for version metadata
import pkg from "semver/package.json" with { type: "json" };
import { describe, expect, it } from "vitest";

const PATCHED_AT = "7.5.2";

describe("semver dependency", () => {
  it("resolves to a version patched against CVE-2022-25883 (GHSA-c2qf-rxjj-qqgw)", () => {
    expect(gte(pkg.version, PATCHED_AT)).toBe(true);
  });
});
