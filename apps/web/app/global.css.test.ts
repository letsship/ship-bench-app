import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB_DIR = resolve(import.meta.dirname, "..");

function read(...parts: string[]) {
  return readFileSync(resolve(WEB_DIR, ...parts), "utf8");
}

/* -------------------------------------------------------------------------- */
/*  Package.json                                                              */
/* -------------------------------------------------------------------------- */
describe("package.json", () => {
  const pkg = JSON.parse(read("package.json"));

  it("lists tailwindcss at ^4", () => {
    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^4/);
  });

  it("lists @tailwindcss/postcss at ^4", () => {
    expect(pkg.devDependencies["@tailwindcss/postcss"]).toMatch(/^\^4/);
  });

  it("does not list autoprefixer", () => {
    expect(pkg.devDependencies.autoprefixer).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  postcss.config.mjs                                                        */
/* -------------------------------------------------------------------------- */
describe("postcss.config.mjs", () => {
  const raw = read("postcss.config.mjs");

  it("uses @tailwindcss/postcss as the only Tailwind plugin", () => {
    expect(raw).toContain("@tailwindcss/postcss");
  });

  it("does not list the bare tailwindcss plugin (v3 style)", () => {
    expect(raw).not.toContain("tailwindcss:");
    expect(raw).not.toContain('"tailwindcss"');
  });
});

/* -------------------------------------------------------------------------- */
/*  tailwind.config.js — must be gone                                         */
/* -------------------------------------------------------------------------- */
describe("tailwind.config.js", () => {
  it("does not exist under apps/web", () => {
    expect(existsSync(resolve(WEB_DIR, "tailwind.config.js"))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  global.css — @import "tailwindcss"                                        */
/* -------------------------------------------------------------------------- */
describe("global.css — entry directives", () => {
  const css = read("app", "global.css");

  it('starts with @import "tailwindcss"', () => {
    expect(css).toMatch(/^@import\s+"tailwindcss"/m);
  });

  it("contains @source directives for app and lib", () => {
    expect(css).toContain('@source "../app"');
    expect(css).toContain('@source "../lib"');
  });

  it("does not contain the old v3 at-tailwind directives", () => {
    expect(css).not.toContain("@tailwind base");
    expect(css).not.toContain("@tailwind components");
    expect(css).not.toContain("@tailwind utilities");
  });
});

/* -------------------------------------------------------------------------- */
/*  global.css — @theme block                                                 */
/* -------------------------------------------------------------------------- */
describe("global.css — @theme token block", () => {
  const css = read("app", "global.css");

  it("declares --font-sans with the expected stack", () => {
    expect(css).toMatch(
      /--font-sans:\s*ui-sans-serif,\s*system-ui,\s*-apple-system,\s*"Segoe UI",\s*Roboto,\s*Helvetica,\s*sans-serif/,
    );
  });

  it("declares --font-serif with the expected stack", () => {
    expect(css).toMatch(
      /--font-serif:\s*"Iowan Old Style",\s*"Palatino Linotype",\s*Palatino,\s*Georgia,\s*serif/,
    );
  });

  it("declares --color-parchment: #f6f1e7", () => {
    expect(css).toContain("--color-parchment: #f6f1e7");
  });
  it("declares --color-surface: #fffdf8", () => {
    expect(css).toContain("--color-surface: #fffdf8");
  });
  it("declares --color-ink: #2c2417", () => {
    expect(css).toContain("--color-ink: #2c2417");
  });
  it("declares --color-muted: #857a66", () => {
    expect(css).toContain("--color-muted: #857a66");
  });
  it("declares --color-clay: #b5623a", () => {
    expect(css).toContain("--color-clay: #b5623a");
  });
  it("declares --color-clay-soft: #f0d9cd", () => {
    expect(css).toContain("--color-clay-soft: #f0d9cd");
  });
  it("declares --color-sage: #5b8c5a", () => {
    expect(css).toContain("--color-sage: #5b8c5a");
  });
  it("declares --color-sage-soft: #dcead9", () => {
    expect(css).toContain("--color-sage-soft: #dcead9");
  });
  it("declares --color-line: #e7ddca", () => {
    expect(css).toContain("--color-line: #e7ddca");
  });
  it("declares --color-danger: #b3402f", () => {
    expect(css).toContain("--color-danger: #b3402f");
  });

  it("does not declare the tokens inside :root (they moved to @theme)", () => {
    // The :root rule should only keep color-scheme: light
    const rootMatch = css.match(/:root\s*\{[^}]*\}/);
    if (rootMatch) {
      expect(rootMatch[0]).not.toContain("--color-");
      expect(rootMatch[0]).not.toContain("--font-");
    }
  });

  it("keeps color-scheme: light in :root", () => {
    expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*light[^}]*\}/);
  });

  it("declares the tokens inside an @theme block", () => {
    expect(css).toMatch(/@theme\s*\{[^}]*--color-parchment/);
  });
});

/* -------------------------------------------------------------------------- */
/*  global.css — ::placeholder pin                                            */
/* -------------------------------------------------------------------------- */
describe("global.css — ::placeholder colour pin", () => {
  const css = read("app", "global.css");

  it("has a ::placeholder rule with color #9ca3af", () => {
    expect(css).toMatch(/::placeholder\s*\{[^}]*color:\s*#9ca3af[^}]*\}/);
  });
});

/* -------------------------------------------------------------------------- */
/*  Resolution: tailwindcss resolves to v4                                    */
/* -------------------------------------------------------------------------- */
describe("resolved tailwindcss version", () => {
  it("resolves to a 4.x version via require", () => {
    const require = createRequire(resolve(WEB_DIR, "package.json"));
    const pkg = require("tailwindcss/package.json");
    expect(pkg.version).toMatch(/^4\./);
  });
});