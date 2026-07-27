import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Tailwind CSS v4 migration invariants", () => {
  const webDir = path.join(import.meta.dirname, "..");
  const globalCssPath = path.join(webDir, "app", "global.css");
  const postcssCfgPath = path.join(webDir, "postcss.config.mjs");

  it("global.css imports tailwindcss with @import directive", () => {
    const content = fs.readFileSync(globalCssPath, "utf-8");
    expect(content).toContain('@import "tailwindcss"');
  });

  it("global.css does not contain old @tailwind directives", () => {
    const content = fs.readFileSync(globalCssPath, "utf-8");
    expect(content).not.toContain("@tailwind base");
    expect(content).not.toContain("@tailwind components");
    expect(content).not.toContain("@tailwind utilities");
  });

  it("global.css defines a @theme block", () => {
    const content = fs.readFileSync(globalCssPath, "utf-8");
    expect(content).toContain("@theme");
  });

  it("postcss.config.mjs uses @tailwindcss/postcss plugin", () => {
    const content = fs.readFileSync(postcssCfgPath, "utf-8");
    expect(content).toContain("@tailwindcss/postcss");
  });

  it("no old tailwind.config.* file exists in apps/web", () => {
    const configs = [
      "tailwind.config.js",
      "tailwind.config.ts",
      "tailwind.config.cjs",
      "tailwind.config.mjs",
    ];

    for (const configName of configs) {
      const configPath = path.join(webDir, configName);
      expect(fs.existsSync(configPath)).toBe(false);
    }
  });
});
