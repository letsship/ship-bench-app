import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = join(fileURLToPath(import.meta.url), "..");

describe("Tailwind v4 migration", () => {
  it("global.css imports tailwindcss and has no old @tailwind directives", () => {
    const globalCssPath = join(__dirname, "../../app/global.css");
    const content = readFileSync(globalCssPath, "utf-8");
    expect(content).toContain('@import "tailwindcss"');
    expect(content).not.toContain("@tailwind base");
    expect(content).not.toContain("@tailwind components");
    expect(content).not.toContain("@tailwind utilities");
  });

  it("postcss.config.mjs uses @tailwindcss/postcss plugin", () => {
    const postcssCfgPath = join(__dirname, "../../postcss.config.mjs");
    const content = readFileSync(postcssCfgPath, "utf-8");
    expect(content).toContain("@tailwindcss/postcss");
    expect(content).not.toContain("plugins.tailwindcss");
  });

  it("tailwind.config.js does not exist", () => {
    // Check for any variant of tailwind.config
    const baseDir = join(__dirname, "../../");
    const variantExtensions = ["js", "cjs", "mjs", "ts"];

    for (const ext of variantExtensions) {
      const filePath = join(baseDir, `tailwind.config.${ext}`);
      try {
        readFileSync(filePath, "utf-8");
        throw new Error(`tailwind.config.${ext} should not exist`);
      } catch (error) {
        // File should not exist, which is what we want
        if (error instanceof Error && error.code !== "ENOENT") {
          throw error;
        }
      }
    }
  });

  it("package.json has tailwindcss and @tailwindcss/postcss at v4", () => {
    const packageJsonPath = join(__dirname, "../../package.json");
    const content = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    expect(content.devDependencies.tailwindcss).toMatch(/^\^4/);
    expect(content.devDependencies["@tailwindcss/postcss"]).toMatch(/^\^4/);
    expect(content.devDependencies.autoprefixer).toBeUndefined();
  });

  it("global.css has @theme block with design tokens", () => {
    const globalCssPath = join(__dirname, "../../app/global.css");
    const content = readFileSync(globalCssPath, "utf-8");

    expect(content).toContain("@theme {");
    expect(content).toContain("--color-parchment");
    expect(content).toContain("--color-surface");
    expect(content).toContain("--color-ink");
    expect(content).toContain("--color-clay");
    expect(content).toContain("--color-sage");
    expect(content).toContain("--font-sans");
    expect(content).toContain("--font-serif");
  });
});
