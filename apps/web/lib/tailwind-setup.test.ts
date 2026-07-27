import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(__dirname, "..");

describe("tailwind v4 setup", () => {
  it("wires the @tailwindcss/postcss plugin, not the legacy tailwindcss plugin", () => {
    const postcssConfig = readFileSync(resolve(webRoot, "postcss.config.mjs"), "utf8");
    expect(postcssConfig).toContain("@tailwindcss/postcss");
    expect(postcssConfig).not.toMatch(/\btailwindcss\s*:/);
  });

  it("imports tailwindcss via @import and drops the old @tailwind directives", () => {
    const globalCss = readFileSync(resolve(webRoot, "app/global.css"), "utf8");
    expect(globalCss.trimStart().startsWith('@import "tailwindcss";')).toBe(true);
    expect(globalCss).not.toMatch(/@tailwind\s+(base|components|utilities)\s*;/);
  });

  it("pins tailwindcss and @tailwindcss/postcss to v4 in package.json", () => {
    const pkg = JSON.parse(readFileSync(resolve(webRoot, "package.json"), "utf8"));
    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^4\./);
    expect(pkg.devDependencies["@tailwindcss/postcss"]).toMatch(/^\^4\./);
  });

  it("has no leftover tailwind.config.{js,cjs,mjs,ts}", () => {
    for (const ext of ["js", "cjs", "mjs", "ts"]) {
      expect(existsSync(resolve(webRoot, `tailwind.config.${ext}`))).toBe(false);
    }
  });
});
