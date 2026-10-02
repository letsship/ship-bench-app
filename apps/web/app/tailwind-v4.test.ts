import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Test file is at apps/web/app/tailwind-v4.test.ts
// One level up (../) resolves to apps/web/ where postcss.config.mjs and package.json live.
const ROOT = new URL("../", import.meta.url).pathname;

function read(path: string): string {
  return readFileSync(`${ROOT}${path}`, "utf8");
}

function exists(path: string): boolean {
  return existsSync(`${ROOT}${path}`);
}

describe("Tailwind CSS v4 migration", () => {
  it("uses @tailwindcss/postcss as the PostCSS plugin", () => {
    const postcss = read("postcss.config.mjs");
    expect(postcss).toContain('"@tailwindcss/postcss"');
    expect(postcss).not.toContain('tailwindcss:');
  });

  it("loads Tailwind via @import in global.css", () => {
    const css = read("app/global.css");
    expect(css).toContain('@import "tailwindcss"');
    expect(css).not.toContain("@tailwind base");
    expect(css).not.toContain("@tailwind components");
    expect(css).not.toContain("@tailwind utilities");
  });

  it("defines design tokens inside @theme in global.css", () => {
    const css = read("app/global.css");
    const themeTokens = [
      "--font-sans",
      "--font-serif",
      "--color-parchment",
      "--color-surface",
      "--color-ink",
      "--color-muted",
      "--color-clay",
      "--color-clay-soft",
      "--color-sage",
      "--color-sage-soft",
      "--color-line",
      "--color-danger",
    ];
    for (const token of themeTokens) {
      expect(css).toContain(token);
    }
    // Extract the @theme block and verify tokens are inside it
    const themeMatch = css.match(/@theme\s*\{([^}]*)\}/);
    expect(themeMatch).not.toBeNull();
    const themeBody = themeMatch![1];
    for (const token of themeTokens) {
      expect(themeBody).toContain(token);
    }
  });

  it("has no tailwind.config.js", () => {
    expect(exists("tailwind.config.js")).toBe(false);
  });

  it("declares tailwindcss major version 4 in package.json", () => {
    const pkg = read("package.json");
    const parsed = JSON.parse(pkg);
    const tw = parsed.devDependencies?.tailwindcss ?? parsed.dependencies?.tailwindcss;
    expect(tw).toBeDefined();
    // Accept ^4, ~4.0.0, 4.x.x etc.
    expect(tw!.startsWith("^4") || tw!.startsWith("~4") || tw!.startsWith("4")).toBe(true);
  });
});