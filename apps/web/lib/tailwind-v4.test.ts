import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readPackageFile = (path: string) => readFileSync(resolve(packageRoot, path), "utf8");

describe("Tailwind CSS v4 setup", () => {
  it("imports Tailwind from CSS without legacy directives", () => {
    const globalCss = readPackageFile("app/global.css");

    expect(globalCss).toContain('@import "tailwindcss";');
    expect(globalCss).toContain("@theme {");
    expect(globalCss).not.toMatch(/@tailwind\s+(base|components|utilities)\s*;/);
  });

  it("uses the dedicated PostCSS plugin", () => {
    const postcssConfig = readPackageFile("postcss.config.mjs");

    expect(postcssConfig).toContain('"@tailwindcss/postcss": {}');
    expect(postcssConfig).not.toMatch(/^\s*tailwindcss\s*:/m);
    expect(postcssConfig).not.toMatch(/^\s*autoprefixer\s*:/m);
  });

  it("has no legacy JavaScript Tailwind configuration", () => {
    const configNames = ["tailwind.config.js", "tailwind.config.cjs", "tailwind.config.mjs", "tailwind.config.ts"];
    const packageFiles = readdirSync(packageRoot);

    expect(configNames.some((configName) => packageFiles.includes(configName))).toBe(false);
    expect(configNames.some((configName) => existsSync(resolve(packageRoot, configName)))).toBe(false);
  });
});
