import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = join(__dirname, "..");

function read(p: string): string {
  return readFileSync(join(webRoot, p), "utf8");
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === ".open-next") continue;
      walk(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

describe("Tailwind CSS v4 migration", () => {
  it("pulls Tailwind in with a single @import and no @tailwind directives", () => {
    const css = read("app/global.css");
    const imports = css.match(/@import\s+"tailwindcss";/g) ?? [];
    expect(imports).toHaveLength(1);
    expect(css).not.toMatch(/@tailwind\s+(base|components|utilities);/);
  });

  it("defines every design token in an @theme block at its original value", () => {
    const css = read("app/global.css");
    const theme = css.match(/@theme\s*{([^}]*)}/)?.[1];
    expect(theme).toBeTruthy();

    const tokens: Record<string, string> = {
      "--color-parchment": "#f6f1e7",
      "--color-surface": "#fffdf8",
      "--color-ink": "#2c2417",
      "--color-muted": "#857a66",
      "--color-clay": "#b5623a",
      "--color-clay-soft": "#f0d9cd",
      "--color-sage": "#5b8c5a",
      "--color-sage-soft": "#dcead9",
      "--color-line": "#e7ddca",
      "--color-danger": "#b3402f",
      "--font-sans":
        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif',
      "--font-serif": '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    };

    for (const [name, value] of Object.entries(tokens)) {
      expect(theme).toMatch(new RegExp(`${name}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")};`));
    }
  });

  it("configures @tailwindcss/postcss in postcss.config.mjs with no bare tailwindcss key", () => {
    const postcss = read("postcss.config.mjs");
    expect(postcss).toContain("@tailwindcss/postcss");
    expect(postcss).toMatch(/plugins\s*:\s*\{\s*["']@tailwindcss\/postcss["']\s*:/);
    expect(postcss).not.toMatch(/plugins\s*:\s*\{\s*["']tailwindcss["']\s*:/);
  });

  it("removes the JavaScript tailwind config", () => {
    const files = walk(webRoot);
    const configs = files.filter((f) => {
      const name = relative(webRoot, f);
      return /^tailwind\.config\.(js|cjs|mjs|ts)$/.test(name);
    });
    expect(configs).toEqual([]);
  });

  it("declares tailwindcss ^4 and @tailwindcss/postcss and drops autoprefixer", () => {
    const pkg = JSON.parse(read("package.json")) as {
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies["tailwindcss"]).toBe("^4");
    expect(pkg.devDependencies["@tailwindcss/postcss"]).toBe("^4");
    expect(pkg.devDependencies["autoprefixer"]).toBeUndefined();
  });

  it("locks tailwindcss at 4.x and drops the 3.x entries from the root lockfile", () => {
    const lock = readFileSync(join(webRoot, "../../pnpm-lock.yaml"), "utf8");
    expect(lock).toMatch(/tailwindcss@4\.\d+\.\d+/);
    expect(lock).not.toMatch(/tailwindcss@3\.\d+\.\d+/);
  });
});
