import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression guard for the Tailwind CSS v4 migration (stb-859).
 *
 * The web app moved from Tailwind v3 (JS config + `@tailwind` directives) to
 * v4 (CSS-first config via `@import "tailwindcss"` + `@theme`, with the
 * `@tailwindcss/postcss` PostCSS plugin). These tests pin the toolchain
 * invariants so the migration cannot silently revert.
 *
 * Paths are resolved from `process.cwd()` (the Vitest root is `apps/web`) so
 * the guard works regardless of where the runner is invoked.
 */
const webRoot = process.cwd();

const read = (relative: string): string => {
  const path = resolve(webRoot, relative);
  return readFileSync(path, "utf8");
};

describe("Tailwind CSS v4 toolchain", () => {
  it("uses the @tailwindcss/postcss PostCSS plugin, not the legacy tailwindcss plugin", () => {
    const postcss = read("postcss.config.mjs");

    expect(postcss).toContain("@tailwindcss/postcss");
    // The legacy v3 setup registered the bare `tailwindcss` PostCSS plugin.
    // Ensure no such plugin key remains (allow the package name only inside
    // the `@tailwindcss/postcss` reference).
    expect(postcss).not.toMatch(/^\s*['"]?tailwindcss['"]?\s*:/m);
  });

  it("imports Tailwind via `@import \"tailwindcss\"` and drops the @tailwind directives", () => {
    const css = read("app/global.css");

    expect(css).toContain('@import "tailwindcss";');
    expect(css).not.toContain("@tailwind base;");
    expect(css).not.toContain("@tailwind components;");
    expect(css).not.toContain("@tailwind utilities;");
  });

  it("moves configuration into CSS via an @theme block", () => {
    const css = read("app/global.css");
    expect(css).toMatch(/@theme\s*\{/);
    // Tokens that used to live in tailwind.config.js / :root.
    expect(css).toContain("--color-parchment:");
    expect(css).toContain("--color-clay:");
    expect(css).toContain("--font-sans:");
    expect(css).toContain("--font-serif:");
  });

  it("has no legacy JavaScript Tailwind config", () => {
    for (const ext of ["js", "ts", "cjs", "mjs"]) {
      const path = resolve(webRoot, `tailwind.config.${ext}`);
      expect(existsSync(path), `unexpected legacy config at ${path}`).toBe(false);
    }
  });

  it("pins tailwindcss and @tailwindcss/postcss to a v4 range", () => {
    const pkg = JSON.parse(read("package.json")) as {
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    expect(deps.tailwindcss).toMatch(/^[\^~]?4\./);
    expect(deps["@tailwindcss/postcss"]).toMatch(/^[\^~]?4\./);
  });
});
