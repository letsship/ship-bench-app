import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(__dirname, "..");

describe("tailwind v4 setup", () => {
  it("has no legacy tailwind.config.* file", () => {
    for (const ext of ["js", "ts", "cjs", "mjs"]) {
      expect(existsSync(resolve(packageRoot, `tailwind.config.${ext}`))).toBe(false);
    }
  });

  it("pulls in tailwind via @import and drops the old @tailwind directives", () => {
    const css = readFileSync(resolve(packageRoot, "app/global.css"), "utf-8");
    expect(css).toContain('@import "tailwindcss"');
    expect(css).not.toMatch(/@tailwind\s+(base|components|utilities)/);
  });

  it("uses the @tailwindcss/postcss plugin in postcss.config.mjs", () => {
    const postcssConfig = readFileSync(resolve(packageRoot, "postcss.config.mjs"), "utf-8");
    expect(postcssConfig).toContain("@tailwindcss/postcss");
  });

  it("declares tailwindcss v4 and @tailwindcss/postcss in package.json", () => {
    const pkg = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf-8"));
    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^?4\./);
    expect(pkg.devDependencies["@tailwindcss/postcss"]).toBeDefined();
  });
});
