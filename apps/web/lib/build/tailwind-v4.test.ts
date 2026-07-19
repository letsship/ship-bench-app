import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Tailwind v4 migration", () => {
  const webAppRoot = path.resolve(__dirname, "../..");

  it("tailwindcss is at v4 in package.json", () => {
    const packageJsonPath = path.join(webAppRoot, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    expect(packageJson.devDependencies.tailwindcss).toMatch(/^\^4\./);
  });

  it("@tailwindcss/postcss is at v4 in package.json", () => {
    const packageJsonPath = path.join(webAppRoot, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    expect(packageJson.devDependencies["@tailwindcss/postcss"]).toMatch(/^\^4\./);
  });

  it("no legacy v3 tooling (autoprefixer, postcss-import) in devDependencies", () => {
    const packageJsonPath = path.join(webAppRoot, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    expect(packageJson.devDependencies).not.toHaveProperty("autoprefixer");
    expect(packageJson.devDependencies).not.toHaveProperty("postcss-import");
  });

  it("postcss.config.mjs uses @tailwindcss/postcss plugin", () => {
    const postcssConfigPath = path.join(webAppRoot, "postcss.config.mjs");
    const config = fs.readFileSync(postcssConfigPath, "utf-8");

    expect(config).toContain("'@tailwindcss/postcss'");
    expect(config).not.toMatch(/plugins:\s*{\s*tailwindcss:/);
  });

  it("global.css imports tailwindcss with @import", () => {
    const globalCssPath = path.join(webAppRoot, "app/global.css");
    const content = fs.readFileSync(globalCssPath, "utf-8");

    expect(content).toMatch(/@import\s+['"]tailwindcss['"]/);
  });

  it("global.css has no legacy @tailwind directives", () => {
    const globalCssPath = path.join(webAppRoot, "app/global.css");
    const content = fs.readFileSync(globalCssPath, "utf-8");

    expect(content).not.toContain("@tailwind base");
    expect(content).not.toContain("@tailwind components");
    expect(content).not.toContain("@tailwind utilities");
  });

  it("no tailwind.config.* file exists under apps/web", () => {
    const patterns = [
      "tailwind.config.js",
      "tailwind.config.ts",
      "tailwind.config.cjs",
      "tailwind.config.mjs",
    ];
    for (const pattern of patterns) {
      const filePath = path.join(webAppRoot, pattern);
      expect(fs.existsSync(filePath)).toBe(false);
    }
  });
});
