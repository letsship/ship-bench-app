import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const webRoot = resolve(__dirname, "..");
const read = (rel: string): string =>
  readFileSync(resolve(webRoot, rel), "utf8");

function exists(rel: string): boolean {
  return existsSync(resolve(webRoot, rel));
}

function listConfigFiles(): string[] {
  const names = ["tailwind.config.js", "tailwind.config.cjs", "tailwind.config.mjs", "tailwind.config.ts"];
  return names.filter((name) => exists(name));
}

describe("Tailwind CSS v4 toolchain", () => {
  it("declares tailwindcss as a v4 devDependency", () => {
    const pkg = JSON.parse(read("package.json")) as {
      devDependencies?: Record<string, string>;
    };
    const tailwind = pkg.devDependencies?.tailwindcss;
    expect(tailwind).toBeTruthy();
    expect(tailwind).toMatch(/^[\^~]?4\./);
  });

  it("declares @tailwindcss/postcss as a v4 devDependency", () => {
    const pkg = JSON.parse(read("package.json")) as {
      devDependencies?: Record<string, string>;
    };
    const postcss = pkg.devDependencies?.["@tailwindcss/postcss"];
    expect(postcss).toBeTruthy();
    expect(postcss).toMatch(/^[\^~]?4\./);
  });

  it("does not depend on the v3-only autoprefixer package", () => {
    const pkg = JSON.parse(read("package.json")) as {
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    expect(pkg.devDependencies?.autoprefixer).toBeUndefined();
    expect(pkg.dependencies?.autoprefixer).toBeUndefined();
  });

  it("loads the @tailwindcss/postcss plugin in postcss.config.mjs", () => {
    const config = read("postcss.config.mjs");
    expect(config).toContain("@tailwindcss/postcss");
    expect(config).not.toMatch(/plugins:\s*\{[^}]*\btailwindcss\b\s*:/);
  });

  it('imports Tailwind via "@import "tailwindcss"" in app/global.css', () => {
    const css = read("app/global.css");
    expect(css).toContain('@import "tailwindcss";');
    expect(css).not.toContain("@tailwind base");
    expect(css).not.toContain("@tailwind components");
    expect(css).not.toContain("@tailwind utilities");
  });

  it("expresses theme tokens in CSS via @theme", () => {
    const css = read("app/global.css");
    expect(css).toContain("@theme");
    expect(css).toContain("--color-parchment");
    expect(css).toContain("--font-sans");
  });

  it("removes the legacy JavaScript Tailwind config", () => {
    expect(listConfigFiles()).toEqual([]);
  });
});
