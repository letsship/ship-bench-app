import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(__dirname, "..");

describe("tailwind v4 migration", () => {
  it("pulls in tailwind via @import in the global stylesheet, with no legacy @tailwind directives", () => {
    const css = readFileSync(resolve(webRoot, "app/global.css"), "utf8");
    expect(css).toContain('@import "tailwindcss"');
    expect(css).not.toMatch(/@tailwind\s+(base|components|utilities)/);
  });

  it("configures postcss with the v4 @tailwindcss/postcss plugin", () => {
    const config = readFileSync(resolve(webRoot, "postcss.config.mjs"), "utf8");
    expect(config).toContain("@tailwindcss/postcss");
    expect(config).not.toMatch(/\btailwindcss\s*:\s*\{\}/);
  });

  it("pins tailwindcss and @tailwindcss/postcss to v4 in package.json", () => {
    const pkg = JSON.parse(readFileSync(resolve(webRoot, "package.json"), "utf8"));
    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^?4\./);
    expect(pkg.devDependencies["@tailwindcss/postcss"]).toMatch(/^\^?4\./);
  });

  it("has no legacy tailwind.config.* file (config lives in CSS)", () => {
    for (const ext of ["js", "cjs", "mjs", "ts"]) {
      expect(existsSync(resolve(webRoot, `tailwind.config.${ext}`))).toBe(false);
    }
  });
});
