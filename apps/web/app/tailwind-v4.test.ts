import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(__dirname, "..");

describe("tailwind v4 migration", () => {
  it("uses the @tailwindcss/postcss plugin, not the legacy tailwindcss plugin", () => {
    const postcssConfig = readFileSync(resolve(packageRoot, "postcss.config.mjs"), "utf-8");

    expect(postcssConfig).toContain("@tailwindcss/postcss");
    expect(postcssConfig).not.toMatch(/[^@/]\btailwindcss\s*:/);
  });

  it("pulls Tailwind into global.css via @import, not the legacy @tailwind directives", () => {
    const globalCss = readFileSync(resolve(packageRoot, "app/global.css"), "utf-8");

    expect(globalCss).toContain('@import "tailwindcss"');
    expect(globalCss).not.toMatch(/@tailwind\s+(base|components|utilities)\s*;/);
  });

  it("has no leftover tailwind.config.* file (config now lives in CSS)", () => {
    const configFiles = readdirSync(packageRoot).filter((name) =>
      /^tailwind\.config\.(js|cjs|mjs|ts)$/.test(name),
    );

    expect(configFiles).toEqual([]);
    expect(existsSync(resolve(packageRoot, "tailwind.config.js"))).toBe(false);
  });

  it("pins tailwindcss and @tailwindcss/postcss to a v4 major version", () => {
    const pkg = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf-8"));

    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^?4\./);
    expect(pkg.devDependencies["@tailwindcss/postcss"]).toMatch(/^\^?4\./);
  });
});
