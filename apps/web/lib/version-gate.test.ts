import { describe, expect, it } from "vitest";
import {
  checkClientVersionGate,
  isClientVersionSupported,
  MINIMUM_CLIENT_VERSION,
} from "./version-gate";
import semverPackage from "semver/package.json";

describe("version-gate", () => {
  it("accepts versions at or above the minimum", () => {
    expect(isClientVersionSupported("1.0.0", "1.0.0")).toBe(true);
    expect(isClientVersionSupported("1.1.0", "1.0.0")).toBe(true);
    expect(isClientVersionSupported("2.0.0", "1.0.0")).toBe(true);
  });

  it("rejects versions below the minimum", () => {
    expect(isClientVersionSupported("0.9.0", "1.0.0")).toBe(false);
    expect(isClientVersionSupported("0.1.0", "1.0.0")).toBe(false);
  });

  it("returns false for invalid version strings", () => {
    expect(isClientVersionSupported("invalid", "1.0.0")).toBe(false);
    expect(isClientVersionSupported("1.0.0", "invalid")).toBe(false);
  });

  it("checks against the configured minimum client version", () => {
    expect(checkClientVersionGate(MINIMUM_CLIENT_VERSION)).toBe(true);
    expect(checkClientVersionGate("1.0.1")).toBe(true);
  });

  it("guards against vulnerable semver versions", () => {
    // Verify that the resolved semver version is >= 7.5.2 (not in the vulnerable range >=7.0.0 <7.5.2)
    const semverVersionStr = semverPackage.version;
    const [major, minor, patch] = semverVersionStr.split(".").map(Number);

    if (major === 7 && minor === 5) {
      expect(patch).toBeGreaterThanOrEqual(2);
    } else if (major === 7) {
      expect(minor).toBeGreaterThan(5);
    } else {
      expect(major).toBeGreaterThan(7);
    }
  });
});
