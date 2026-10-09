import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const webRoot = resolve(import.meta.dirname, "..");

describe("Tailwind CSS v4 migration", () => {
  it("AC-1: tailwindcss resolves to 4.x in package.json", () => {
    const pkg = JSON.parse(readFileSync(resolve(webRoot, "package.json"), "utf8"));
    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^4/);
  });

  it("AC-1: @tailwindcss/postcss is declared in package.json", () => {
    const pkg = JSON.parse(readFileSync(resolve(webRoot, "package.json"), "utf8"));
    expect(pkg.devDependencies["@tailwindcss/postcss"]).toMatch(/^\^4/);
  });

  it("AC-2: postcss.config.mjs uses @tailwindcss/postcss, not tailwindcss or autoprefixer", () => {
    const content = readFileSync(resolve(webRoot, "postcss.config.mjs"), "utf8");
    expect(content).toContain("@tailwindcss/postcss");
    expect(content).not.toContain("tailwindcss:");
    expect(content).not.toContain("autoprefixer");
  });

  it("AC-3: global.css uses @import 'tailwindcss' and no @tailwind directives", () => {
    const content = readFileSync(resolve(webRoot, "app/global.css"), "utf8");
    expect(content).toContain('@import "tailwindcss"');
    expect(content).not.toContain("@tailwind base");
    expect(content).not.toContain("@tailwind components");
    expect(content).not.toContain("@tailwind utilities");
  });

  it("AC-4: tailwind.config.js is removed", () => {
    expect(existsSync(resolve(webRoot, "tailwind.config.js"))).toBe(false);
  });

  it("AC-4: @theme static block defines all custom tokens", () => {
    const content = readFileSync(resolve(webRoot, "app/global.css"), "utf8");
    expect(content).toContain("@theme static");
    expect(content).toContain("--font-sans:");
    expect(content).toContain("--font-serif:");
    expect(content).toContain("--color-parchment:");
    expect(content).toContain("--color-surface:");
    expect(content).toContain("--color-ink:");
    expect(content).toContain("--color-muted:");
    expect(content).toContain("--color-clay:");
    expect(content).toContain("--color-clay-soft:");
    expect(content).toContain("--color-sage:");
    expect(content).toContain("--color-sage-soft:");
    expect(content).toContain("--color-line:");
    expect(content).toContain("--color-danger:");
  });
});