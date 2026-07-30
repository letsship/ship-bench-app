import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Regression guard for CVE-2022-25883 (GHSA-c2qf-rxjj-qqgw): the `semver`
// range parser was vulnerable to ReDoS in versions `>=7.0.0 <7.5.2`.
// `apps/web` pulls `semver` in to gate the minimum supported client build, so a
// re-introduction of an affected version re-opens the advisory. This test
// scans the workspace-root lockfile (the source of truth for what the package
// manager resolves) and fails if any `semver@<version>` resolution lands in the
// vulnerable range. It deliberately uses only `node:fs` / `node:path` rather
// than importing `semver`, because `semver` is transitive-only under pnpm and
// is not hoisted into `apps/web`'s top-level `node_modules`.

const LOCKFILE_PATH = resolve(__dirname, "../../../../pnpm-lock.yaml");
const ADVISORY_RANGE = ">=7.0.0 <7.5.2";

// Minimal semver comparator scoped to what the advisory range needs: a version
// is in the vulnerable range iff its major is 7 and its minor/patch are below
// 5.2. Kept local so the guard does not depend on the `semver` package itself.
function isVulnerable(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (major !== 7) return false;
  if (minor < 5) return true;
  if (minor === 5 && patch < 2) return true;
  return false;
}

function parseLockfileSemverVersions(lockfile: string): string[] {
  const versions: string[] = [];
  // Match top-level package keys of the form `  semver@<version>:` (two-space
  // indent marks an entry in the `packages:` block under pnpm's lockfile v9).
  for (const line of lockfile.split("\n")) {
    const match = /^ {2}semver@(\S+):\s*$/.exec(line);
    if (match) versions.push(match[1]);
  }
  return versions;
}

describe("CVE-2022-25883 (semver ReDoS) regression guard", () => {
  it("resolves no semver version in the vulnerable range", () => {
    const lockfile = readFileSync(LOCKFILE_PATH, "utf8");
    const versions = parseLockfileSemverVersions(lockfile);

    expect(versions.length, "expected at least one semver resolution").toBeGreaterThan(0);

    const vulnerable = versions.filter(isVulnerable);
    expect(
      vulnerable,
      `found vulnerable semver resolution(s) in ${ADVISORY_RANGE}: ${vulnerable.join(", ")}`,
    ).toEqual([]);
  });
});
