import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Regression guard for the Tailwind CSS v4 migration: the app must keep the
// CSS-first v4 setup (@tailwindcss/postcss + `@import "tailwindcss"` + @theme)
// and must not drift back to the v3 JS-config toolchain.
const webRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(webRoot, "../..");

const readWeb = (rel: string) => readFileSync(path.join(webRoot, rel), "utf8");

const isV4Range = (range: unknown) => typeof range === "string" && /^\^?4\./.test(range.trim());

describe("Tailwind CSS v4 toolchain", () => {
  it("pins tailwindcss and @tailwindcss/postcss to v4 in package.json", () => {
    const pkg = JSON.parse(readWeb("package.json")) as {
      devDependencies?: Record<string, string>;
    };
    expect(isV4Range(pkg.devDependencies?.tailwindcss)).toBe(true);
    expect(isV4Range(pkg.devDependencies?.["@tailwindcss/postcss"])).toBe(true);
  });

  it("uses @tailwindcss/postcss as the PostCSS plugin", () => {
    const postcss = readWeb("postcss.config.mjs");
    expect(postcss).toContain("@tailwindcss/postcss");
    expect(postcss).not.toMatch(/plugins:\s*{[^}]*\btailwindcss\s*:/s);
    expect(postcss).not.toContain("autoprefixer");
  });

  it("imports Tailwind via CSS instead of legacy @tailwind directives", () => {
    const css = readWeb("app/global.css");
    expect(css).toContain('@import "tailwindcss"');
    expect(css).not.toMatch(/^@tailwind\s+(base|components|utilities)\s*;/m);
  });

  it("keeps the design tokens in the CSS @theme block", () => {
    const css = readWeb("app/global.css");
    expect(css).toContain("@theme {");
    for (const token of ["--color-parchment", "--color-ink", "--color-clay", "--color-sage", "--font-serif"]) {
      expect(css).toContain(token);
    }
  });

  it("has no JavaScript Tailwind config file", () => {
    for (const name of ["tailwind.config.js", "tailwind.config.cjs", "tailwind.config.mjs", "tailwind.config.ts"]) {
      expect(existsSync(path.join(webRoot, name)), `${name} must not exist`).toBe(false);
    }
  });

  it("resolves tailwindcss to v4 in the workspace lockfile", () => {
    const lockfile = readFileSync(path.join(repoRoot, "pnpm-lock.yaml"), "utf8");
    expect(lockfile).toMatch(/tailwindcss@4\./);
    expect(lockfile).toContain("@tailwindcss/postcss@4.");
    expect(lockfile).not.toMatch(/tailwindcss@3\./);
  });
});
