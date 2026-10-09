import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import postcssConfig from "../postcss.config.mjs";

const webRoot = fileURLToPath(new URL("..", import.meta.url));

const read = (relative: string): string => readFileSync(join(webRoot, relative), "utf8");

const DESIGN_TOKENS = [
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
  "--font-sans",
  "--font-serif",
] as const;

describe("Tailwind CSS v4 setup", () => {
  it("declares v4 Tailwind packages and no autoprefixer in package.json", () => {
    const pkg = JSON.parse(read("package.json")) as {
      devDependencies: Record<string, string>;
    };

    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^4(\.|$)/);
    expect(pkg.devDependencies["@tailwindcss/postcss"]).toMatch(/^\^4(\.|$)/);
    expect(pkg.devDependencies.autoprefixer).toBeUndefined();
  });

  it("postcss.config.mjs uses the @tailwindcss/postcss plugin, not tailwindcss", () => {
    const plugins = postcssConfig.plugins as Record<string, unknown>;

    expect(Object.keys(plugins)).toEqual(["@tailwindcss/postcss"]);
    expect(plugins["@tailwindcss/postcss"]).toBeDefined();
    expect(plugins.tailwindcss).toBeUndefined();
  });

  it("global.css imports tailwindcss instead of the old @tailwind directives", () => {
    const css = read("app/global.css");

    expect(css).toContain('@import "tailwindcss"');
    expect(css).not.toContain("@tailwind base");
    expect(css).not.toContain("@tailwind components");
    expect(css).not.toContain("@tailwind utilities");
  });

  it("removes the v3 JavaScript config", () => {
    expect(existsSync(join(webRoot, "tailwind.config.js"))).toBe(false);
  });

  it("defines every design token in an @theme block in global.css", () => {
    const css = read("app/global.css");
    const themeBlock = css.match(/@theme\s+static\s*\{([\s\S]*?)\}/)?.[1] ?? "";

    expect(themeBlock).not.toBe("");
    for (const token of DESIGN_TOKENS) {
      expect(themeBlock).toContain(`${token}:`);
    }
  });
});
