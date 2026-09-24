import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB_DIR = resolve(import.meta.dirname, "..");
const APP_DIR = resolve(WEB_DIR, "app");

const GLOBAL_CSS_PATH = resolve(APP_DIR, "global.css");
const POSTCSS_CONFIG_PATH = resolve(WEB_DIR, "postcss.config.mjs");
const PACKAGE_JSON_PATH = resolve(WEB_DIR, "package.json");
const TAILWIND_CONFIG_PATH = resolve(WEB_DIR, "tailwind.config.js");

describe("Tailwind CSS v4 migration", () => {
  /* ------------------------------------------------------------------ */
  /*  Static setup assertions                                            */
  /* ------------------------------------------------------------------ */

  describe("static setup", () => {
    it("apps/web/tailwind.config.js does not exist (AC-7)", () => {
      expect(existsSync(TAILWIND_CONFIG_PATH)).toBe(false);
    });

    it("global.css uses @import \"tailwindcss\" (AC-5) and no @tailwind directives (AC-6)", () => {
      const css = readFileSync(GLOBAL_CSS_PATH, "utf8");
      expect(css).toContain('@import "tailwindcss"');
      expect(css).not.toContain("@tailwind base");
      expect(css).not.toContain("@tailwind components");
      expect(css).not.toContain("@tailwind utilities");
    });

    it("declares a theme block with all design tokens (AC-8)", () => {
      const css = readFileSync(GLOBAL_CSS_PATH, "utf8");
      expect(css).toContain("@theme");
      expect(css).toContain("--font-sans");
      expect(css).toContain("--font-serif");
      // All ten color tokens
      expect(css).toContain("--color-parchment: #f6f1e7");
      expect(css).toContain("--color-surface: #fffdf8");
      expect(css).toContain("--color-ink: #2c2417");
      expect(css).toContain("--color-muted: #857a66");
      expect(css).toContain("--color-clay: #b5623a");
      expect(css).toContain("--color-clay-soft: #f0d9cd");
      expect(css).toContain("--color-sage: #5b8c5a");
      expect(css).toContain("--color-sage-soft: #dcead9");
      expect(css).toContain("--color-line: #e7ddca");
      expect(css).toContain("--color-danger: #b3402f");
    });

    it("carries both @source directives (AC-9)", () => {
      const css = readFileSync(GLOBAL_CSS_PATH, "utf8");
      expect(css).toContain('@source "../app/**/*.{ts,tsx}"');
      expect(css).toContain('@source "../lib/**/*.{ts,tsx}"');
    });

    it("postcss.config.mjs names @tailwindcss/postcss (AC-3) and no bare tailwindcss (AC-4)", () => {
      const cfg = readFileSync(POSTCSS_CONFIG_PATH, "utf8");
      expect(cfg).toContain("@tailwindcss/postcss");
      // The legacy bare "tailwindcss" plugin key would appear as
      // `"tailwindcss":` (quoted + colon). Use a quote-agnostic regex
      // so we do not miss it if the quoting style changes.
      expect(cfg).not.toMatch(/["']?tailwindcss["']?\s*:/);
    });

    it("package.json declares tailwindcss ^4 (AC-1) and @tailwindcss/postcss (AC-3)", () => {
      const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
      // AC-1: range must start with ^4 (any 4.x minor/patch is fine)
      expect(pkg.devDependencies.tailwindcss).toMatch(/^\^4/);
      // AC-3: @tailwindcss/postcss must be declared in devDependencies
      expect(pkg.devDependencies["@tailwindcss/postcss"]).toBeDefined();
      expect(pkg.devDependencies["@tailwindcss/postcss"]).toMatch(/^\^4/);
    });

    it("has a placeholder compatibility rule (AC-11)", () => {
      const css = readFileSync(GLOBAL_CSS_PATH, "utf8");
      expect(css).toContain("::placeholder");
      expect(css).toContain("#9ca3af");
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Behavioral assertion: compile through the v4 PostCSS plugin         */
  /* ------------------------------------------------------------------ */

  describe("v4 compilation (AC-10)", () => {
    it("emits design tokens, preflight, and utilities", async () => {
      const { default: postcss } = await import("postcss");
      const tailwindPlugin = (await import("@tailwindcss/postcss")).default;

      const css = readFileSync(GLOBAL_CSS_PATH, "utf8");
      const result = await postcss([tailwindPlugin()]).process(css, {
        from: GLOBAL_CSS_PATH,
      });

      const output = result.css;

      // Design-token custom property is emitted
      expect(output).toContain("--color-parchment: #f6f1e7");

      // Preflight rules are injected (universal-box-sizing reset is a v4 preflight staple)
      expect(output).toContain("*, ::after, ::before");

      // Base element rules (html, body, h1-h3, a, placeholder) land in @layer base
      expect(output).toContain("@layer base");

      // At least one utility from the scanned source
      expect(output).toContain(".rounded-full");

      // Placeholder colour is emitted
      expect(output).toContain("color: #9ca3af");
    });
  });
});
