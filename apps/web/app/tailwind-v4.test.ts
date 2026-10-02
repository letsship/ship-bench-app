import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const appDir = resolve(import.meta.dirname, "..");
const pkgPath = resolve(appDir, "package.json");
const cssPath = resolve(appDir, "app", "global.css");
const postcssPath = resolve(appDir, "postcss.config.mjs");
const tailwindConfigPath = resolve(appDir, "tailwind.config.js");

describe("Tailwind CSS v4 setup", () => {
  it("global.css imports tailwindcss and has no @tailwind directives", () => {
    const css = readFileSync(cssPath, "utf-8");
    expect(css).toContain('@import "tailwindcss"');
    expect(css).not.toMatch(/@tailwind\s+/);
  });

  it("postcss.config.mjs uses @tailwindcss/postcss and not the legacy tailwindcss plugin", async () => {
    const mod = await import(postcssPath);
    const plugins = mod.default.plugins;
    expect(Object.keys(plugins)).toEqual(["@tailwindcss/postcss"]);
  });

  it("tailwind.config.js has been deleted", () => {
    expect(existsSync(tailwindConfigPath)).toBe(false);
  });

  it("package.json declares tailwindcss with a ^4 range", () => {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const devDeps = pkg.devDependencies || {};
    expect(devDeps.tailwindcss).toMatch(/^\^4/);
  });

  it("package.json declares @tailwindcss/postcss as a devDependency", () => {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const devDeps = pkg.devDependencies || {};
    expect(devDeps["@tailwindcss/postcss"]).toMatch(/^\^4/);
  });

  it("package.json no longer lists autoprefixer", () => {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const devDeps = pkg.devDependencies || {};
    expect(devDeps.autoprefixer).toBeUndefined();
  });

  it("global.css @theme block declares the expected tokens", () => {
    const css = readFileSync(cssPath, "utf-8");
    // Check that @theme inline block exists with all expected tokens
    expect(css).toContain("@theme inline");
    expect(css).toContain("--color-parchment: var(--color-parchment)");
    expect(css).toContain("--color-surface: var(--color-surface)");
    expect(css).toContain("--color-ink: var(--color-ink)");
    expect(css).toContain("--color-muted: var(--color-muted)");
    expect(css).toContain("--color-clay: var(--color-clay)");
    expect(css).toContain("--color-clay-soft: var(--color-clay-soft)");
    expect(css).toContain("--color-sage: var(--color-sage)");
    expect(css).toContain("--color-sage-soft: var(--color-sage-soft)");
    expect(css).toContain("--color-line: var(--color-line)");
    expect(css).toContain("--color-danger: var(--color-danger)");
    expect(css).toContain("--font-sans: var(--font-sans)");
    expect(css).toContain("--font-serif: var(--font-serif)");
  });

  it("global.css wraps element rules in @layer base", () => {
    const css = readFileSync(cssPath, "utf-8");
    expect(css).toContain("@layer base");
    // The html, body, h1, a rules should be inside @layer base
    expect(css).toContain("html {\n    -webkit-text-size-adjust: 100%;\n  }");
  });

  it("global.css keeps :root tokens unlayered and unchanged", () => {
    const css = readFileSync(cssPath, "utf-8");
    expect(css).toContain("--color-parchment: #f6f1e7");
    expect(css).toContain("--color-ink: #2c2417");
  });

  it("global.css has v3-compat base rules inside @layer base", () => {
    const css = readFileSync(cssPath, "utf-8");
    // Verify the compat rules live inside the @layer base block so v4
    // utilities still beat them, matching v3 precedence.
    const layerBaseIndex = css.indexOf("@layer base");
    expect(layerBaseIndex).not.toBe(-1);
    const layerSection = css.substring(layerBaseIndex, css.indexOf("/* --- Components --- */"));
    expect(layerSection).toContain("border-color: currentColor");
    expect(layerSection).toContain("::placeholder");
    expect(layerSection).toContain("button:not(:disabled)");
  });
});
