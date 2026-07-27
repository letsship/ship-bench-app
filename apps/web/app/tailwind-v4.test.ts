import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// App root is the directory containing this test file
const APP_ROOT = join(__dirname, "..");

describe("Tailwind v4 migration", () => {
  it("should use @tailwindcss/postcss PostCSS plugin", () => {
    const postcssPath = join(APP_ROOT, "postcss.config.mjs");
    const content = readFileSync(postcssPath, "utf-8");

    expect(content).toContain("@tailwindcss/postcss");
    expect(content).not.toContain("tailwindcss: {}");
    expect(content).not.toContain("autoprefixer");
  });

  it("should use @import tailwindcss in global.css", () => {
    const globalCssPath = join(APP_ROOT, "app", "global.css");
    const content = readFileSync(globalCssPath, "utf-8");

    expect(content).toContain('@import "tailwindcss"');
    expect(content).not.toContain("@tailwind base");
    expect(content).not.toContain("@tailwind components");
    expect(content).not.toContain("@tailwind utilities");
  });

  it("should have @theme block in global.css", () => {
    const globalCssPath = join(APP_ROOT, "app", "global.css");
    const content = readFileSync(globalCssPath, "utf-8");

    expect(content).toContain("@theme {");
  });

  it("should not have tailwind.config.js", () => {
    const configJs = join(APP_ROOT, "tailwind.config.js");
    const configTs = join(APP_ROOT, "tailwind.config.ts");
    const configCjs = join(APP_ROOT, "tailwind.config.cjs");
    const configMjs = join(APP_ROOT, "tailwind.config.mjs");

    expect(existsSync(configJs)).toBe(false);
    expect(existsSync(configTs)).toBe(false);
    expect(existsSync(configCjs)).toBe(false);
    expect(existsSync(configMjs)).toBe(false);
  });

  it("should declare v4 tailwindcss in package.json", () => {
    const packageJsonPath = join(APP_ROOT, "package.json");
    const content = readFileSync(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);

    const tailwindVersion = packageJson.devDependencies.tailwindcss;
    expect(tailwindVersion).toMatch(/^\^4\./);

    expect(packageJson.devDependencies["@tailwindcss/postcss"]).toBeDefined();
  });

  it("should not have autoprefixer or v3 tailwindcss remnants", () => {
    const packageJsonPath = join(APP_ROOT, "package.json");
    const content = readFileSync(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);

    expect(packageJson.devDependencies.autoprefixer).toBeUndefined();
    expect(packageJson.dependencies.tailwindcss).toBeUndefined();
  });
});
