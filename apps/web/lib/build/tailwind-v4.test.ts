import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const appRoot = join(import.meta.dirname, "../..");

describe("Tailwind v4 migration", () => {
  it("uses @tailwindcss/postcss in PostCSS config", () => {
    const postcssConfig = readFileSync(join(appRoot, "postcss.config.mjs"), "utf-8");
    expect(postcssConfig).toContain("'@tailwindcss/postcss'");
    expect(postcssConfig).not.toContain("'tailwindcss': {}");
    expect(postcssConfig).not.toContain("autoprefixer");
  });

  it('uses @import "tailwindcss" in global.css', () => {
    const globalCss = readFileSync(join(appRoot, "app/global.css"), "utf-8");
    expect(globalCss).toContain('@import "tailwindcss"');
    expect(globalCss).not.toContain("@tailwind base");
    expect(globalCss).not.toContain("@tailwind components");
    expect(globalCss).not.toContain("@tailwind utilities");
  });

  it("has @theme block in global.css for design tokens", () => {
    const globalCss = readFileSync(join(appRoot, "app/global.css"), "utf-8");
    expect(globalCss).toContain("@theme {");
    expect(globalCss).toContain("--color-parchment");
    expect(globalCss).toContain("--color-ink");
  });

  it("does not have a tailwind.config.js file", () => {
    expect(existsSync(join(appRoot, "tailwind.config.js"))).toBe(false);
    expect(existsSync(join(appRoot, "tailwind.config.ts"))).toBe(false);
    expect(existsSync(join(appRoot, "tailwind.config.mjs"))).toBe(false);
    expect(existsSync(join(appRoot, "tailwind.config.cjs"))).toBe(false);
  });

  it("declares tailwindcss@^4 in package.json", () => {
    const pkg = readFileSync(join(appRoot, "package.json"), "utf-8");
    const parsed = JSON.parse(pkg);
    expect(parsed.devDependencies.tailwindcss).toMatch(/^\^4/);
  });

  it("declares @tailwindcss/postcss@^4 in package.json", () => {
    const pkg = readFileSync(join(appRoot, "package.json"), "utf-8");
    const parsed = JSON.parse(pkg);
    expect(parsed.devDependencies["@tailwindcss/postcss"]).toMatch(/^\^4/);
  });
});
