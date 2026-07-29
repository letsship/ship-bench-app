import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function findLockfile(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const candidate = resolve(dir, "pnpm-lock.yaml");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("pnpm-lock.yaml not found");
}

const LOCKFILE_PATH = findLockfile(__dirname);

interface SemverEntry {
  version: string;
}

function parseLockfileSemverEntries(filePath: string): SemverEntry[] {
  const content = readFileSync(filePath, "utf-8");
  const pattern = /(?:^|\s)semver@(\d+\.\d+\.\d+):/gm;
  const entries: SemverEntry[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    entries.push({ version: match[1] });
  }
  return entries;
}

function isAffected(version: string): boolean {
  const parts = version.split(".").map(Number);
  if (parts[0] !== 7) return false;
  if (parts[0] === 7 && parts[1] < 5) return true;
  if (parts[0] === 7 && parts[1] === 5 && parts[2] < 2) return true;
  return false;
}

describe("CVE-2022-25883: semver ReDoS advisory", () => {
  const entries = parseLockfileSemverEntries(LOCKFILE_PATH);

  it("no resolved semver@7 version falls in the vulnerable range (>=7.0.0 <7.5.2)", () => {
    const affected = entries.filter(
      (e) => e.version.startsWith("7.") && isAffected(e.version),
    );
    expect(affected).toEqual([]);
  });

  it("resolves at least one semver version (sanity)", () => {
    expect(entries.length).toBeGreaterThan(0);
  });
});