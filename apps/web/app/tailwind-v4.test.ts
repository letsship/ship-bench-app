import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readWebFile(relativePath: string): string {
  return readFileSync(resolve(webRoot, relativePath), "utf8");
}

describe("tailwind v4 toolchain", () => {
  const pkg: { devDependencies: Record<string, string> } = JSON.parse(readWebFile("package.json"));

  it("declares tailwindcss at major version 4", () => {
    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^?4\./);
  });

  it("declares @tailwindcss/postcss at major version 4", () => {
    expect(pkg.devDependencies["@tailwindcss/postcss"]).toMatch(/^\^?4\./);
  });

  it("registers @tailwindcss/postcss as the postcss plugin", async () => {
    const { default: config }: { default: { plugins: Record<string, unknown> } } = await import(
      pathToFileURL(resolve(webRoot, "postcss.config.mjs")).href
    );
    expect(Object.keys(config.plugins)).toEqual(["@tailwindcss/postcss"]);
  });

  it("imports tailwind through the css entry point", () => {
    expect(readWebFile("app/global.css")).toContain('@import "tailwindcss";');
  });

  it("contains no v3 @tailwind directives in global.css", () => {
    expect(readWebFile("app/global.css")).not.toMatch(/@tailwind\s+(base|components|utilities)/);
  });

  it.each(["js", "ts", "cjs", "mjs"])("has no tailwind.config.%s file", (extension) => {
    expect(existsSync(resolve(webRoot, `tailwind.config.${extension}`))).toBe(false);
  });
});
