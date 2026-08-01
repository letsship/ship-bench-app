import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appDirectory = dirname(fileURLToPath(import.meta.url));
const webDirectory = join(appDirectory, "..");

describe("Tailwind CSS v4 setup", () => {
  it("uses the CSS-first stylesheet and PostCSS plugin", () => {
    const globalStylesheet = readFileSync(join(appDirectory, "global.css"), "utf8");
    const postcssConfig = readFileSync(join(webDirectory, "postcss.config.mjs"), "utf8");

    expect(globalStylesheet).toContain('@import "tailwindcss"');
    expect(globalStylesheet).not.toMatch(/@tailwind\s+(base|components|utilities)\s*;/);
    expect(postcssConfig).toContain('"@tailwindcss/postcss"');
    expect(postcssConfig).not.toContain("tailwindcss: {}");
  });

  it("does not retain a JavaScript Tailwind config", () => {
    const configFiles = readdirSync(webDirectory).filter((file) =>
      /^tailwind\.config\.(js|ts|cjs|mjs)$/.test(file),
    );

    expect(configFiles).toEqual([]);
    expect(existsSync(join(webDirectory, "tailwind.config.js"))).toBe(false);
  });
});
