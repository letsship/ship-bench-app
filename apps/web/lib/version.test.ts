import { gte } from "semver";
import semverPkg from "semver/package.json";
import { describe, expect, it } from "vitest";
import { isSupportedClientVersion } from "./version";

describe("isSupportedClientVersion", () => {
  it("accepts a version at or above the minimum", () => {
    expect(isSupportedClientVersion("1.4.0")).toBe(true);
    expect(isSupportedClientVersion("2.0.1")).toBe(true);
  });

  it("rejects an older or malformed version", () => {
    expect(isSupportedClientVersion("1.3.9")).toBe(false);
    expect(isSupportedClientVersion("not-a-version")).toBe(false);
  });
});

describe("semver dependency", () => {
  it("resolves to a release patched against CVE-2022-25883", () => {
    expect(gte(semverPkg.version, "7.5.2")).toBe(true);
  });
});
