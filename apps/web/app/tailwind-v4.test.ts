import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Tailwind v4 Migration", () => {
  const webDir = process.cwd();

  it("should use @tailwindcss/postcss plugin in postcss.config.mjs", () => {
    const postcssConfigPath = join(webDir, "postcss.config.mjs");
    const postcssContent = readFileSync(postcssConfigPath, "utf-8");

    expect(postcssContent).toContain("@tailwindcss/postcss");
    expect(postcssContent).not.toMatch(/plugins:\s*{\s*tailwindcss:/);
  });

  it('should use @import "tailwindcss" in global.css', () => {
    const globalCssPath = join(webDir, "app", "global.css");
    const cssContent = readFileSync(globalCssPath, "utf-8");

    expect(cssContent).toContain('@import "tailwindcss"');
  });

  it("should not have @tailwind directives in global.css", () => {
    const globalCssPath = join(webDir, "app", "global.css");
    const cssContent = readFileSync(globalCssPath, "utf-8");

    expect(cssContent).not.toMatch(/@tailwind\s+(base|components|utilities)/);
  });

  it("should not have tailwind.config.js or .ts file", () => {
    const configFiles = [
      join(webDir, "tailwind.config.js"),
      join(webDir, "tailwind.config.ts"),
      join(webDir, "tailwind.config.cjs"),
      join(webDir, "tailwind.config.mjs"),
    ];

    for (const configFile of configFiles) {
      try {
        readFileSync(configFile, "utf-8");
        throw new Error(`tailwind.config file should not exist at ${configFile}, but it does`);
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          err.message.startsWith("tailwind.config file should not exist")
        ) {
          throw err;
        }
      }
    }
  });

  it("should have @theme block with design tokens in global.css", () => {
    const globalCssPath = join(webDir, "app", "global.css");
    const cssContent = readFileSync(globalCssPath, "utf-8");

    expect(cssContent).toContain("@theme");
    expect(cssContent).toMatch(/--color-parchment:\s*#f6f1e7/);
    expect(cssContent).toMatch(/--color-ink:\s*#2c2417/);
    expect(cssContent).toMatch(/--color-clay:\s*#b5623a/);
  });
});
