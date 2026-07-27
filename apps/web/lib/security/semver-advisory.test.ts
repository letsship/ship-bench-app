import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { minVersion, satisfies } from "semver";
import { describe, expect, it } from "vitest";

// CVE-2022-25883 / GHSA-c2qf-rxjj-qqgw: the semver range parser can be driven
// into super-linear backtracking (ReDoS) by a crafted version string. Affected
// versions are >=7.0.0 <7.5.2. `lib/version.ts` calls into semver on a
// client-supplied version string, so a vulnerable resolution is reachable from
// untrusted input. These tests fail if that range ever reappears.
const PATCHED = ">=7.5.2";
const VULNERABLE_RANGE = ">=7.0.0 <7.5.2";

function findWorkspaceRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "pnpm-lock.yaml"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error("pnpm-lock.yaml not found");
    dir = parent;
  }
  return dir;
}

const root = findWorkspaceRoot();
const readRoot = (file: string) => readFileSync(join(root, file), "utf8");

describe("semver advisory CVE-2022-25883", () => {
  it("resolves no semver 7.x below the patched release", () => {
    const lockfile = readRoot("pnpm-lock.yaml");
    // Package keys are indented two spaces under `packages:`/`snapshots:`.
    // Requiring a digit after `@` skips the `semver@>=...` overrides entry and
    // the leading quote skips `'@types/semver@...'`.
    const resolved = [
      ...new Set([...lockfile.matchAll(/^ {2}semver@(\d+\.\d+\.\d+[^:]*):/gm)].map((m) => m[1])),
    ];

    expect(resolved.length).toBeGreaterThan(0);
    const vulnerable = resolved.filter((v) => satisfies(v, VULNERABLE_RANGE));
    expect(vulnerable).toEqual([]);
  });

  it("declares a web dependency range that cannot admit a vulnerable version", () => {
    const pkg = JSON.parse(readRoot("apps/web/package.json"));
    const declared = pkg.dependencies.semver;

    // minVersion is the lowest release the range permits; if that is patched,
    // no install of this range can be vulnerable.
    const lowest = minVersion(declared);
    expect(lowest, `unsatisfiable range ${declared}`).not.toBeNull();
    expect(satisfies(lowest!, PATCHED)).toBe(true);
  });

  it("pins the vulnerable range through a workspace-wide override", () => {
    // pnpm 10 reads settings from pnpm-workspace.yaml; the `pnpm` field in
    // package.json is ignored, so the override has to live here to take effect.
    expect(readRoot("pnpm-workspace.yaml")).toMatch(
      /^overrides:\s*\n\s+semver@>=7\.0\.0 <7\.5\.2: ">=7\.5\.2"/m,
    );
  });
});
