import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Tailwind CSS v4 setup", () => {
  const webDir = path.resolve(__dirname, "..");

  it("should have @tailwindcss/postcss in postcss.config.mjs", () => {
    const configPath = path.join(webDir, "postcss.config.mjs");
    const content = fs.readFileSync(configPath, "utf-8");

    expect(content).toContain("@tailwindcss/postcss");
    expect(content).not.toContain("tailwindcss: {}");
    expect(content).not.toContain("autoprefixer");
  });

  it("should use @import in global.css instead of @tailwind directives", () => {
    const globalCssPath = path.join(webDir, "app", "global.css");
    const content = fs.readFileSync(globalCssPath, "utf-8");

    expect(content).toContain('@import "tailwindcss"');
    expect(content).not.toContain("@tailwind base");
    expect(content).not.toContain("@tailwind components");
    expect(content).not.toContain("@tailwind utilities");
  });

  it("should have tailwindcss and @tailwindcss/postcss at ^4 in package.json", () => {
    const pkgPath = path.join(webDir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^4/);
    expect(pkg.devDependencies["@tailwindcss/postcss"]).toMatch(/^\^4/);
  });

  it("should not have a tailwind.config.js file", () => {
    const configNames = [
      "tailwind.config.js",
      "tailwind.config.cjs",
      "tailwind.config.mjs",
      "tailwind.config.ts",
    ];

    for (const configName of configNames) {
      const configPath = path.join(webDir, configName);
      expect(fs.existsSync(configPath)).toBe(false);
    }
  });
});
