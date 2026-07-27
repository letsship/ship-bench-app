import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe("Tailwind v4 setup", () => {
  it("global.css uses @import 'tailwindcss' and not @tailwind directives", () => {
    const globalCssPath = join(appRoot, "app/global.css");
    const content = readFileSync(globalCssPath, "utf-8");

    expect(content).toContain('@import "tailwindcss"');
    expect(content).not.toMatch(/@tailwind\s+(base|components|utilities)/);
  });

  it("postcss.config.mjs uses @tailwindcss/postcss plugin", () => {
    const postCssPath = join(appRoot, "postcss.config.mjs");
    const content = readFileSync(postCssPath, "utf-8");

    expect(content).toContain("@tailwindcss/postcss");
    expect(content).not.toContain("tailwindcss: {}");
  });

  it("package.json declares tailwindcss and @tailwindcss/postcss at v4", () => {
    const packageJsonPath = join(appRoot, "package.json");
    const content = readFileSync(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);

    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^4\./);
    expect(pkg.devDependencies["@tailwindcss/postcss"]).toMatch(/^\^4\./);
  });

  it("tailwind.config.js does not exist at app root", () => {
    const tailwindConfigJs = join(appRoot, "tailwind.config.js");
    const tailwindConfigTs = join(appRoot, "tailwind.config.ts");

    expect(existsSync(tailwindConfigJs)).toBe(false);
    expect(existsSync(tailwindConfigTs)).toBe(false);
  });
});
