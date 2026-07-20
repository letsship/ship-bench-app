import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

describe("Tailwind v4 migration invariants", () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const rootDir = join(__dirname, "..");
  const globalCssPath = join(__dirname, "global.css");
  const postcssConfigPath = join(rootDir, "postcss.config.mjs");

  it("global.css imports tailwindcss", () => {
    const content = readFileSync(globalCssPath, "utf-8");
    expect(content).toMatch(/@import\s+["']tailwindcss["']/);
  });

  it("global.css does not contain legacy @tailwind directives", () => {
    const content = readFileSync(globalCssPath, "utf-8");
    expect(content).not.toMatch(/@tailwind\s+(base|components|utilities)/);
  });

  it("global.css defines theme via @theme block", () => {
    const content = readFileSync(globalCssPath, "utf-8");
    expect(content).toMatch(/@theme\s*\{/);
  });

  it("postcss.config.mjs uses @tailwindcss/postcss plugin", () => {
    const content = readFileSync(postcssConfigPath, "utf-8");
    expect(content).toMatch(/@tailwindcss\/postcss/);
  });

  it("postcss.config.mjs does not use legacy tailwindcss plugin", () => {
    const content = readFileSync(postcssConfigPath, "utf-8");
    expect(content).not.toMatch(/plugins:\s*\{[\s\S]*?['"]tailwindcss['"]\s*:/);
  });

  it("no tailwind.config.js exists in the package", () => {
    const configFiles = [
      "tailwind.config.js",
      "tailwind.config.ts",
      "tailwind.config.cjs",
      "tailwind.config.mjs",
    ];
    for (const file of configFiles) {
      const filePath = join(rootDir, file);
      expect(existsSync(filePath), `${file} should not exist`).toBe(false);
    }
  });
});
