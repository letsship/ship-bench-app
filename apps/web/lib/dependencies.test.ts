import { describe, it, expect } from "vitest";
import fs from "fs";

describe("dependencies", () => {
  it("semver should not be in vulnerable range (CVE-2022-25883: >=7.0.0 <7.5.2)", () => {
    const packageJsonPath = require.resolve("semver/package.json");
    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);
    const version = packageJson.version;

    const parts = version.split(".");
    const major = parseInt(parts[0], 10);
    const minor = parseInt(parts[1], 10);
    const patch = parseInt(parts[2]?.split("-")[0] || "0", 10);

    const isVulnerableRange = major === 7 && (minor < 5 || (minor === 5 && patch < 2));
    expect(isVulnerableRange).toBe(false);
  });
});
