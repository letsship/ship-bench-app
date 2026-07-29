import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(__dirname, "..");
const importers = ["@tailwindcss/postcss"];

function readText(rel: string): string {
  return readFileSync(resolve(webRoot, rel), "utf8");
}

/**
 * Regression guard: the web app is on Tailwind CSS v4 (CSS-first config), not
 * the legacy v3 JS-config setup. If a future edit reintroduces v3 wiring, this
 * test fails CI. See https://tailwindcss.com/docs/upgrade-guide.
 */
describe("tailwind v4 setup", () => {
  it("uses the @tailwindcss/postcss PostCSS plugin, not the legacy tailwindcss plugin", () => {
    const postcss = readText("postcss.config.mjs");
    expect(postcss).toContain("@tailwindcss/postcss");
    // The legacy v3 PostCSS plugin is keyed as bare `tailwindcss`.
    expect(postcss).not.toMatch(/['"]tailwindcss['"]\s*:/);
    for (const name of importers) expect(postcss).toContain(name);
  });

  it("imports tailwind via `@import \"tailwindcss\"` with no v3 @tailwind directives", () => {
    const css = readText("app/global.css");
    expect(css).toContain('@import "tailwindcss";');
    expect(css).not.toMatch(/^@tailwind\s+(base|components|utilities)\s*;?\s*$/m);
  });

  it("configures theme tokens in CSS via @theme (no JS config file)", () => {
    const css = readText("app/global.css");
    expect(css).toContain("@theme");
    const offenders = readdirSync(webRoot).filter((entry) =>
      /^tailwind\.config\.(js|ts|cjs|mjs)$/.test(entry),
    );
    expect(offenders).toEqual([]);
  });

  it("pins tailwindcss and @tailwindcss/postcss to v4 in package.json", () => {
    const pkg = JSON.parse(readText("package.json")) as {
      devDependencies: Record<string, string>;
    };
    const deps = pkg.devDependencies;
    expect(deps["@tailwindcss/postcss"]).toMatch(/^\^4\./);
    expect(deps.tailwindcss).toMatch(/^\^4\./);
  });

  it("resolves tailwindcss to a v4 release in the lockfile", () => {
    const lockfile = readFileSync(
      resolve(webRoot, "../../pnpm-lock.yaml"),
      "utf8",
    );
    // A v4 release is resolved when an importer entry of the form
    // `tailwindcss@4.x.y:` is present and no `tailwindcss@3.` entry remains.
    expect(lockfile).toMatch(/^ {2}tailwindcss@4\.\d+\.\d+:/m);
    expect(lockfile).not.toMatch(/^ {2}tailwindcss@3\./m);
    // Sanity: the files we assert on above actually exist on disk.
    expect(() => statSync(resolve(webRoot, "postcss.config.mjs"))).not.toThrow();
    expect(() => statSync(resolve(webRoot, "app/global.css"))).not.toThrow();
  });
});
