import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const WEB_DIR = resolve(import.meta.dirname, "..");

describe("Tailwind CSS v4 setup", () => {
  it("uses @tailwindcss/postcss plugin (not the old tailwindcss plugin)", () => {
    const content = readFileSync(resolve(WEB_DIR, "postcss.config.mjs"), "utf-8");
    expect(content).toContain("@tailwindcss/postcss");
    expect(content).not.toContain("tailwindcss:");
  });

  it("imports Tailwind with @import in global.css (no @tailwind directives)", () => {
    const content = readFileSync(resolve(WEB_DIR, "app/global.css"), "utf-8");
    expect(content).toContain('@import "tailwindcss"');
    expect(content).not.toContain("@tailwind base");
    expect(content).not.toContain("@tailwind components");
    expect(content).not.toContain("@tailwind utilities");
  });

  it("has no tailwind.config.js (config moved to CSS)", () => {
    expect(existsSync(resolve(WEB_DIR, "tailwind.config.js"))).toBe(false);
  });

  it("declares tailwindcss with a ^4 range in package.json", () => {
    const content = readFileSync(resolve(WEB_DIR, "package.json"), "utf-8");
    const json = JSON.parse(content);
    const devDeps = json.devDependencies as Record<string, string>;
    expect(devDeps["tailwindcss"]).toMatch(/^\^4/);
  });
});