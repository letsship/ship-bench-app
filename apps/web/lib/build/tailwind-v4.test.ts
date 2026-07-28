import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Regression guard for the Tailwind CSS v4 migration: the v4 setup is
// CSS-first (@import "tailwindcss" + @theme), uses the dedicated PostCSS
// plugin, and has no JavaScript config file. These assertions lock that in.
const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const read = (rel: string) => readFileSync(resolve(pkgRoot, rel), "utf8");

const pkg = (): { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } =>
  JSON.parse(read("package.json"));

const allDeps = () => ({ ...pkg().dependencies, ...pkg().devDependencies });

describe("tailwind v4 setup", () => {
  it("pins tailwindcss and @tailwindcss/postcss to v4", () => {
    const deps = allDeps();
    expect(deps["tailwindcss"]).toMatch(/^[~^]?4\./);
    expect(deps["@tailwindcss/postcss"]).toMatch(/^[~^]?4\./);
  });

  it("does not carry v3-era PostCSS plugins", () => {
    const deps = allDeps();
    expect(deps["autoprefixer"]).toBeUndefined();
    expect(deps["postcss-import"]).toBeUndefined();
  });

  it("uses @tailwindcss/postcss as the PostCSS plugin", () => {
    const config = read("postcss.config.mjs");
    expect(config).toContain("@tailwindcss/postcss");
    // The legacy plugin was registered under the bare "tailwindcss" key.
    expect(config).not.toMatch(/["']tailwindcss["']\s*:/);
  });

  it("imports tailwindcss in the global stylesheet", () => {
    const css = read("app/global.css");
    expect(css).toContain('@import "tailwindcss"');
    expect(css).not.toMatch(/@tailwind\s/);
  });

  it("declares theme tokens in CSS via @theme", () => {
    const css = read("app/global.css");
    expect(css).toMatch(/@theme\s*\{/);
    expect(css).toContain("--color-clay");
    expect(css).toContain("--font-serif");
  });

  it("has no tailwind.config.* JavaScript config", () => {
    const candidates = readdirSync(pkgRoot).filter((f) => /^tailwind\.config\./.test(f));
    expect(candidates).toEqual([]);
    expect(existsSync(resolve(pkgRoot, "tailwind.config.js"))).toBe(false);
  });
});
